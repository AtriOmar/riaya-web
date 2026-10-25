import { and, eq, gt, lt, ne } from "drizzle-orm";
import { db } from "@/db";
import { appointment, doctorProfile, patient, type person } from "@/db/schema";
import type { AiAppointment } from "@/lib/ai-chat-parts";
import { personDisplayName } from "@/lib/person-name";
import { PRACTICE_TIME_ZONE, toPracticeTime } from "@/lib/practice-time";

export type ToolContext = { doctorId: number };

/** A problem the model should hear about and can fix (e.g. a wrong id). */
export class ToolError extends Error {}

type AppointmentRow = typeof appointment.$inferSelect & {
	patient: typeof patient.$inferSelect | null;
	person: typeof person.$inferSelect | null;
};

export function toAiAppointment(row: AppointmentRow): AiAppointment {
	return {
		id: row.id,
		start: row.start?.toISOString() ?? null,
		end: row.end?.toISOString() ?? null,
		status: row.status,
		source: row.source,
		urgent: row.urgent,
		name: row.name,
		description: row.description,
		patientId: row.patientId,
		patientName:
			personDisplayName(row.patient) ||
			personDisplayName(row.person) ||
			"Unknown patient",
	};
}

export async function findDoctorAppointment(
	ctx: ToolContext,
	appointmentId: number,
) {
	const row = await db.query.appointment.findFirst({
		where: and(
			eq(appointment.id, appointmentId),
			eq(appointment.doctorId, ctx.doctorId),
		),
		with: { patient: true, person: true },
	});
	if (!row) {
		throw new ToolError(
			`No appointment ${appointmentId} in this practice. Look it up with get_schedule or get_pending_bookings.`,
		);
	}
	return row;
}

export async function findDoctorPatient(ctx: ToolContext, patientId: number) {
	const row = await db.query.patient.findFirst({
		where: and(eq(patient.id, patientId), eq(patient.doctorId, ctx.doctorId)),
	});
	if (!row) {
		throw new ToolError(
			`No patient ${patientId} in this practice. Find the right id with search_patients.`,
		);
	}
	return row;
}

function minutesOfDay(date: Date) {
	const [h, m] = toPracticeTime(date).slice(11).split(":").map(Number);
	return h * 60 + m;
}

/** Availability day index (0 = Monday) in practice time. */
function dayIndex(date: Date) {
	const weekday = new Intl.DateTimeFormat("en-US", {
		timeZone: PRACTICE_TIME_ZONE,
		weekday: "short",
	}).format(date);
	return ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(weekday);
}

/**
 * What the doctor should know before booking `start`–`end`: the past, outside
 * opening hours, or overlapping other appointments. Neither appointment route
 * checks these, so the proposal card shows them.
 */
export async function scheduleWarnings(
	ctx: ToolContext,
	start: Date,
	end: Date,
	excludeAppointmentId?: number,
): Promise<string[]> {
	const warnings: string[] = [];
	if (start < new Date()) warnings.push("This time is in the past.");

	const [profile] = await db
		.select({ availability: doctorProfile.availability })
		.from(doctorProfile)
		.where(eq(doctorProfile.id, ctx.doctorId));
	const openSlots = profile?.availability?.[dayIndex(start)] ?? [];
	const from = minutesOfDay(start);
	const to = from + Math.round((end.getTime() - start.getTime()) / 60_000);
	if (!openSlots.some((slot) => from >= slot.start && to <= slot.end)) {
		warnings.push("Outside your opening hours.");
	}

	const overlapping = await db.query.appointment.findMany({
		where: and(
			eq(appointment.doctorId, ctx.doctorId),
			ne(appointment.status, "cancelled"),
			lt(appointment.start, end),
			gt(appointment.end, start),
			excludeAppointmentId
				? ne(appointment.id, excludeAppointmentId)
				: undefined,
		),
		with: { patient: true, person: true },
		limit: 3,
	});
	for (const row of overlapping) {
		const other = toAiAppointment(row);
		const time = row.start ? toPracticeTime(row.start).slice(11) : "";
		warnings.push(`Overlaps with ${other.patientName} at ${time}.`);
	}
	return warnings;
}
