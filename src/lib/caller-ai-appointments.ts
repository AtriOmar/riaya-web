import { and, asc, desc, eq, gte, inArray, lt, ne, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { appointment, patient, person } from "@/db/schema";
import { apiError } from "@/lib/api-utils";
import { cancelEmergencySiblingAppointments } from "@/lib/emergency-appointments";
import {
	cancelEmergencyPendingTimeoutJob,
	cancelPendingAppointmentTimeoutJob,
} from "@/lib/pending-appointment-timeout";
import {
	DEFAULT_PHONE_COUNTRY,
	normalizePhoneForStorage,
	phoneStorageVariants,
} from "@/lib/phone";

export type CallerAiAppointmentItem = {
	appointmentId: number;
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

function normalizeCallerPhone(phone: string): string | null {
	return normalizePhoneForStorage(phone, DEFAULT_PHONE_COUNTRY);
}

async function patientIdsForCallerPhone(normalized: string): Promise<number[]> {
	const variants = phoneStorageVariants(normalized);
	const personRow = await db.query.person.findFirst({
		where: inArray(person.phoneNumber, variants),
	});
	if (!personRow) return [];
	const rows = await db
		.select({ id: patient.id })
		.from(patient)
		.where(eq(patient.personId, personRow.id));
	return rows.map((r) => r.id);
}

function callerOwnershipClause(variants: string[], patientIds: number[]) {
	const parts = [];
	if (variants.length > 0) {
		parts.push(inArray(appointment.newPatientPhoneNumber, variants));
	}
	if (patientIds.length > 0) {
		parts.push(inArray(appointment.patientId, patientIds));
	}
	if (parts.length === 0) return sql`false`;
	return parts.length === 1 ? parts[0] : or(...parts);
}

function mapRow(row: {
	id: number;
	status: string | null;
	start: Date | null;
	end: Date | null;
	name: string | null;
	description: string | null;
	urgent: boolean;
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

async function baseCallerFilters(phone: string) {
	const normalized = normalizeCallerPhone(phone);
	if (!normalized) return null;
	const variants = phoneStorageVariants(normalized);
	const patientIds = await patientIdsForCallerPhone(normalized);
	return {
		normalized,
		variants,
		patientIds,
		ownership: callerOwnershipClause(variants, patientIds),
	};
}

export async function listAiAppointmentsForCaller(
	phone: string,
	options?: { includeRecentPast?: boolean },
) {
	const base = await baseCallerFilters(phone);
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
		with: { doctor: true },
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
			with: { doctor: true },
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
	const base = await baseCallerFilters(phone);
	if (!base) throw apiError("CALLER_PHONE_REQUIRED");

	const row = await db.query.appointment.findFirst({
		where: and(eq(appointment.id, appointmentId), eq(appointment.source, "ai")),
		with: { doctor: true },
	});

	if (!row) throw apiError("APPOINTMENT_NOT_FOUND");

	const variants = base.variants;
	const phoneMatch =
		row.newPatientPhoneNumber != null &&
		variants.includes(row.newPatientPhoneNumber);
	const patientMatch =
		row.patientId != null && base.patientIds.includes(row.patientId);

	if (!phoneMatch && !patientMatch) throw apiError("FORBIDDEN");

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
