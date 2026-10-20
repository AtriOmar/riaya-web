import { and, asc, desc, eq, gte, inArray, lt, ne, or } from "drizzle-orm";
import { db } from "@/db";
import { appointment } from "@/db/schema";
import { apiError } from "@/lib/api-utils";
import { cancelEmergencySiblingAppointments } from "@/lib/emergency-appointments";
import {
	cancelEmergencyPendingTimeoutJob,
	cancelPendingAppointmentTimeoutJob,
} from "@/lib/pending-appointment-timeout";
import { findPersonsOnPhone, toPersonPhone } from "@/lib/person";
import { personDisplayName } from "@/lib/person-name";

export type CallerAiAppointmentItem = {
	appointmentId: number;
	/** Who the appointment is for (the caller or a family member on the line). */
	patientName: string | null;
	status: string | null;
	start: string | null;
	end: string | null;
	name: string | null;
	description: string | null;
	doctorName: string;
	cabinetName: string | null;
	address: string | null;
	urgent: boolean;
};

const RECENT_PAST_DAYS = 30;

const withDoctorAndPerson = { doctor: true, person: true } as const;

function mapRow(row: {
	id: number;
	status: string | null;
	start: Date | null;
	end: Date | null;
	name: string | null;
	description: string | null;
	urgent: boolean;
	person: { firstName: string | null; lastName: string | null } | null;
	doctor: {
		firstName: string | null;
		lastName: string | null;
		cabinetName: string | null;
		address: string | null;
	} | null;
}): CallerAiAppointmentItem {
	const doctor = row.doctor;
	const doctorName = doctor
		? `Dr. ${[doctor.firstName, doctor.lastName].filter(Boolean).join(" ").trim()}`.trim()
		: "Doctor";
	return {
		appointmentId: row.id,
		patientName: personDisplayName(row.person) || null,
		status: row.status,
		start: row.start?.toISOString() ?? null,
		end: row.end?.toISOString() ?? null,
		name: row.name,
		description: row.description,
		doctorName: doctorName || "Doctor",
		cabinetName: doctor?.cabinetName ?? null,
		address: doctor?.address ?? null,
		urgent: row.urgent,
	};
}

/**
 * The caller's line and everyone on it. An appointment belongs to the caller
 * when it was booked from this line or is for someone on it.
 */
async function callerScope(phone: string) {
	const phoneNumber = toPersonPhone(phone);
	if (!phoneNumber) return null;
	const personIds = (await findPersonsOnPhone(phoneNumber)).map((p) => p.id);
	const ownership =
		personIds.length > 0
			? or(
					eq(appointment.contactPhone, phoneNumber),
					inArray(appointment.personId, personIds),
				)
			: eq(appointment.contactPhone, phoneNumber);
	return { phoneNumber, personIds, ownership };
}

export async function listAiAppointmentsForCaller(
	phone: string,
	options?: { includeRecentPast?: boolean },
) {
	const base = await callerScope(phone);
	if (!base) {
		return {
			upcoming: [] as CallerAiAppointmentItem[],
			recentPast: [] as CallerAiAppointmentItem[],
		};
	}

	const now = new Date();
	const sharedWhere = and(
		eq(appointment.source, "ai"),
		ne(appointment.status, "cancelled"),
		base.ownership,
	);

	const upcomingRows = await db.query.appointment.findMany({
		where: and(
			sharedWhere,
			gte(appointment.start, now),
			or(
				eq(appointment.status, "pending"),
				eq(appointment.status, "confirmed"),
			),
		),
		with: withDoctorAndPerson,
		orderBy: [asc(appointment.start)],
		limit: 3,
	});

	let recentPastRows: typeof upcomingRows = [];
	if (options?.includeRecentPast !== false) {
		const pastCutoff = new Date(now);
		pastCutoff.setDate(pastCutoff.getDate() - RECENT_PAST_DAYS);
		recentPastRows = await db.query.appointment.findMany({
			where: and(
				sharedWhere,
				lt(appointment.start, now),
				gte(appointment.start, pastCutoff),
			),
			with: withDoctorAndPerson,
			orderBy: [desc(appointment.start)],
			limit: 1,
		});
	}

	return {
		upcoming: upcomingRows.map(mapRow),
		recentPast: recentPastRows.map(mapRow),
	};
}

export async function assertCallerOwnsAppointment(
	appointmentId: number,
	phone: string,
) {
	const base = await callerScope(phone);
	if (!base) throw apiError("CALLER_PHONE_REQUIRED");

	const row = await db.query.appointment.findFirst({
		where: and(eq(appointment.id, appointmentId), eq(appointment.source, "ai")),
		with: { doctor: true },
	});

	if (!row) throw apiError("APPOINTMENT_NOT_FOUND");

	const ownsByLine = row.contactPhone === base.phoneNumber;
	const ownsByPerson =
		row.personId != null && base.personIds.includes(row.personId);
	if (!ownsByLine && !ownsByPerson) throw apiError("FORBIDDEN");

	return row;
}

export async function cancelPendingAiAppointmentForCaller(
	appointmentId: number,
	phone: string,
) {
	const row = await assertCallerOwnsAppointment(appointmentId, phone);

	if (row.status !== "pending") {
		throw apiError("APPOINTMENT_NOT_CANCELLABLE");
	}

	// Cancelling one urgent fan-out request cancels the whole emergency group.
	if (row.urgent && row.emergencyGroupId) {
		await cancelEmergencySiblingAppointments({
			emergencyGroupId: row.emergencyGroupId,
		});
		void cancelEmergencyPendingTimeoutJob(row.emergencyGroupId);
		const refreshed = await db.query.appointment.findFirst({
			where: eq(appointment.id, appointmentId),
		});
		return refreshed ?? row;
	}

	const [updated] = await db
		.update(appointment)
		.set({ status: "cancelled", updatedAt: new Date() })
		.where(eq(appointment.id, appointmentId))
		.returning();

	void cancelPendingAppointmentTimeoutJob(appointmentId);

	return updated;
}
