import { and, asc, desc, eq, gte, inArray, lt, ne } from "drizzle-orm";
import type { z } from "zod";
import { db } from "@/db";
import {
	appointment,
	consultationRecording,
	doctorProfile,
	invoice,
	patientMedicalFile,
} from "@/db/schema";
import type {
	AiInvoice,
	ReadToolName,
	ReadToolResult,
	readToolSchemas,
} from "@/lib/ai-chat-parts";
import { getDoctorDashboardStats } from "@/lib/dashboard-stats";
import { listSlotsForDay } from "@/lib/doctor-slots";
import { searchPatients } from "@/lib/patients";
import { personDisplayName } from "@/lib/person-name";
import { findDoctorPatient, type ToolContext, toAiAppointment } from "./shared";
import { fromPracticeTime } from "./time";

type ReadTool<N extends ReadToolName> = {
	description: string;
	run: (
		ctx: ToolContext,
		args: z.infer<(typeof readToolSchemas)[N]["input"]>,
	) => Promise<ReadToolResult<N>>;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function toAiInvoice(
	row: typeof invoice.$inferSelect & {
		patient: { firstName: string | null; lastName: string | null } | null;
	},
): AiInvoice {
	return {
		id: row.id,
		number: row.number,
		status: row.status,
		totalCentimes: row.totalCentimes,
		amountPaidCentimes: row.amountPaidCentimes,
		issuedAt: row.issuedAt?.toISOString() ?? null,
		patientId: row.patientId,
		patientName: personDisplayName(row.patient) || "Unknown patient",
	};
}

export const readTools: { [N in ReadToolName]: ReadTool<N> } = {
	get_schedule: {
		description:
			"The doctor's appointments (pending and confirmed) between two days, inclusive. Use for questions about the schedule, a day, or who is coming.",
		async run(ctx, { from, to }) {
			const rows = await db.query.appointment.findMany({
				where: and(
					eq(appointment.doctorId, ctx.doctorId),
					ne(appointment.status, "cancelled"),
					gte(appointment.start, fromPracticeTime(from)),
					lt(
						appointment.start,
						new Date(fromPracticeTime(to).getTime() + DAY_MS),
					),
				),
				with: { patient: true, person: true },
				orderBy: asc(appointment.start),
				limit: 100,
			});
			return { from, to, appointments: rows.map(toAiAppointment) };
		},
	},

	get_pending_bookings: {
		description:
			"Upcoming bookings waiting for the doctor to accept or refuse (mostly booked by patients over the phone with the AI).",
		async run(ctx) {
			const rows = await db.query.appointment.findMany({
				where: and(
					eq(appointment.doctorId, ctx.doctorId),
					eq(appointment.status, "pending"),
					gte(appointment.start, new Date()),
				),
				with: { patient: true, person: true },
				orderBy: asc(appointment.start),
				limit: 50,
			});
			return { appointments: rows.map(toAiAppointment) };
		},
	},

	search_patients: {
		description:
			"Find the doctor's patients by name or CIN. Use it to get a patient's id before any other tool that needs one.",
		async run(ctx, { query }) {
			const rows = await searchPatients(ctx.doctorId, query, { limit: 10 });
			return {
				query,
				patients: rows.map((p) => ({
					...p,
					dateOfBirth: p.dateOfBirth?.toISOString() ?? null,
				})),
			};
		},
	},

	get_patient_summary: {
		description:
			"Everything useful about one patient: profile, recent and upcoming appointments, recent medical files, consultation notes from recordings, and unpaid invoices. Use before briefing the doctor on a patient.",
		async run(ctx, { patientId }) {
			const p = await findDoctorPatient(ctx, patientId);
			const now = new Date();
			const [past, upcoming, files, recordings, unpaid] = await Promise.all([
				db.query.appointment.findMany({
					where: and(
						eq(appointment.patientId, p.id),
						lt(appointment.start, now),
						ne(appointment.status, "cancelled"),
					),
					with: { patient: true, person: true },
					orderBy: desc(appointment.start),
					limit: 5,
				}),
				db.query.appointment.findMany({
					where: and(
						eq(appointment.patientId, p.id),
						gte(appointment.start, now),
						ne(appointment.status, "cancelled"),
					),
					with: { patient: true, person: true },
					orderBy: asc(appointment.start),
					limit: 3,
				}),
				db
					.select()
					.from(patientMedicalFile)
					.where(eq(patientMedicalFile.patientId, p.id))
					.orderBy(desc(patientMedicalFile.date))
					.limit(5),
				db
					.select({
						id: consultationRecording.id,
						title: consultationRecording.title,
						createdAt: consultationRecording.createdAt,
						summary: consultationRecording.summary,
					})
					.from(consultationRecording)
					.where(
						and(
							eq(consultationRecording.patientId, p.id),
							eq(consultationRecording.doctorId, ctx.doctorId),
						),
					)
					.orderBy(desc(consultationRecording.createdAt))
					.limit(3),
				db.query.invoice.findMany({
					where: and(
						eq(invoice.patientId, p.id),
						inArray(invoice.status, ["unpaid", "partially_paid"]),
					),
					with: { patient: true },
					orderBy: desc(invoice.issuedAt),
				}),
			]);
			return {
				patient: {
					id: p.id,
					firstName: p.firstName,
					lastName: p.lastName,
					cin: p.cin,
					dateOfBirth: p.dateOfBirth?.toISOString() ?? null,
					phoneNumber: p.phoneNumber,
				},
				appointments: [...upcoming.reverse(), ...past].map(toAiAppointment),
				medicalFiles: files.map((f) => ({
					id: f.id,
					type: f.type,
					title: f.title,
					date: f.date?.toISOString() ?? null,
					description: f.description?.slice(0, 1500) ?? null,
				})),
				recordings: recordings.map((r) => ({
					id: r.id,
					title: r.title,
					date: r.createdAt?.toISOString() ?? null,
					summary: r.summary ?? null,
				})),
				unpaidInvoices: unpaid.map(toAiInvoice),
			};
		},
	},

	get_free_slots: {
		description:
			"Free 30-minute slots on one day, from the doctor's opening hours minus existing appointments. Use before proposing a new time.",
		async run(ctx, { date }) {
			const day = fromPracticeTime(date);
			const [profile] = await db
				.select({ availability: doctorProfile.availability })
				.from(doctorProfile)
				.where(eq(doctorProfile.id, ctx.doctorId));
			const taken = await db
				.select({ start: appointment.start, end: appointment.end })
				.from(appointment)
				.where(
					and(
						eq(appointment.doctorId, ctx.doctorId),
						ne(appointment.status, "cancelled"),
						gte(appointment.start, day),
						lt(appointment.start, new Date(day.getTime() + DAY_MS)),
					),
				);
			const slots = listSlotsForDay(
				profile?.availability ?? {},
				taken,
				new Date(),
				day,
			);
			return {
				date,
				slots: slots.map((s) => ({
					start: s.start.toISOString(),
					end: s.end.toISOString(),
				})),
			};
		},
	},

	get_invoices: {
		description:
			"The doctor's invoices, newest first, optionally only one status (e.g. unpaid) or one patient. Amounts are in millimes (1 TND = 1000).",
		async run(ctx, { status, patientId }) {
			const rows = await db.query.invoice.findMany({
				where: and(
					eq(invoice.doctorId, ctx.doctorId),
					status ? eq(invoice.status, status) : undefined,
					patientId ? eq(invoice.patientId, patientId) : undefined,
				),
				with: { patient: true },
				orderBy: desc(invoice.issuedAt),
				limit: 50,
			});
			return { invoices: rows.map(toAiInvoice) };
		},
	},

	get_practice_stats: {
		description:
			"The practice at a glance: patients, appointments today and this week, pending bookings, unpaid invoices and revenue. Amounts are in millimes.",
		async run(ctx) {
			const stats = await getDoctorDashboardStats(ctx.doctorId);
			return {
				patients: stats.counts.patients,
				appointmentsToday: stats.counts.appointmentsToday,
				appointmentsThisWeek: stats.counts.appointmentsThisWeek,
				pendingAppointments: stats.counts.pendingAppointments,
				unpaidInvoices: stats.counts.unpaidInvoices,
				collectedThisMonthCentimes: Number(stats.revenue.collectedThisMonth),
				outstandingCentimes: Number(stats.revenue.outstanding),
			};
		},
	},
};
