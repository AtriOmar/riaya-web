import { and, eq } from "drizzle-orm";
import type { z } from "zod";
import { db } from "@/db";
import { appointment } from "@/db/schema";
import type {
	ActionProposal,
	ActionToolName,
	actionToolSchemas,
} from "@/lib/ai-chat-parts";
import { findDoctorPatientByPerson } from "@/lib/appointment-patient-link";
import { tndToMillimes } from "@/lib/money";
import { personDisplayName } from "@/lib/person-name";
import {
	findDoctorAppointment,
	findDoctorPatient,
	scheduleWarnings,
	type ToolContext,
	ToolError,
	toAiAppointment,
} from "./shared";
import { fromPracticeTime } from "./time";

// Action tools only prepare a proposal: they check ownership and add what the
// card needs (names, totals, warnings) but change nothing. The doctor's
// Confirm click runs the real route.

type ActionTool<N extends ActionToolName> = {
	description: string;
	propose: (
		ctx: ToolContext,
		args: z.infer<(typeof actionToolSchemas)[N]["input"]>,
	) => Promise<{ proposal: ActionProposal<N>; warnings: string[] }>;
};

const MINUTE_MS = 60_000;

export const actionTools: { [N in ActionToolName]: ActionTool<N> } = {
	propose_invoice: {
		description:
			"Propose an invoice for a patient. The doctor reviews and confirms it; nothing is created until then. Ask for the price if the doctor didn't give one.",
		async propose(ctx, { patientId, appointmentId, items, notes }) {
			const p = await findDoctorPatient(ctx, patientId);
			const warnings: string[] = [];

			let linkedAppointmentId: number | null = null;
			if (appointmentId) {
				const [row] = await db
					.select({ id: appointment.id })
					.from(appointment)
					.where(
						and(
							eq(appointment.id, appointmentId),
							eq(appointment.doctorId, ctx.doctorId),
							eq(appointment.patientId, p.id),
						),
					);
				if (row) linkedAppointmentId = row.id;
				else
					warnings.push(
						"The appointment given isn't this patient's, so it isn't linked.",
					);
			}

			const proposalItems = items.map((item) => ({
				description: item.description,
				quantity: item.quantity,
				unitPriceCentimes: tndToMillimes(item.unitPriceTnd),
			}));
			if (proposalItems.every((item) => item.unitPriceCentimes === 0)) {
				warnings.push("The total is 0 TND.");
			}

			return {
				proposal: {
					patientId: p.id,
					patientName: personDisplayName(p) || "Unknown patient",
					appointmentId: linkedAppointmentId,
					items: proposalItems,
					notes: notes ?? "",
				},
				warnings,
			};
		},
	},

	propose_booking_decision: {
		description:
			"Propose accepting or refusing one pending booking. Accepting confirms it and the patient gets the usual WhatsApp confirmation. Call it once per booking.",
		async propose(ctx, { appointmentId, decision }) {
			const row = await findDoctorAppointment(ctx, appointmentId);
			if (row.status !== "pending") {
				throw new ToolError(
					`Appointment ${appointmentId} is ${row.status}, not pending, so there is nothing to accept or refuse.`,
				);
			}

			let newPatient: { firstName: string; lastName: string } | null = null;
			const warnings: string[] = [];
			if (decision === "accept") {
				if (!row.patientId) {
					if (!row.personId || !row.person) {
						throw new ToolError(
							"This booking isn't linked to anyone, so it needs a patient picked by hand. Tell the doctor to accept it from the Appointments calendar.",
						);
					}
					const existing = await findDoctorPatientByPerson(
						ctx.doctorId,
						row.personId,
					);
					if (!existing) {
						newPatient = {
							firstName: row.person.firstName ?? "",
							lastName: row.person.lastName ?? "",
						};
						if (!newPatient.firstName) {
							throw new ToolError(
								"The caller didn't give a name, so a patient file can't be created. Tell the doctor to accept it from the Appointments calendar.",
							);
						}
					}
				}
				if (row.start && row.end) {
					warnings.push(
						...(await scheduleWarnings(ctx, row.start, row.end, row.id)).filter(
							(w) => w !== "This time is in the past.",
						),
					);
				}
			}

			return {
				proposal: { decision, appointment: toAiAppointment(row), newPatient },
				warnings,
			};
		},
	},

	propose_medical_note: {
		description:
			"Propose saving a note to a patient's medical files (a consultation note, prescription or lab report). The doctor can edit it before confirming.",
		async propose(ctx, { patientId, type, title, description }) {
			const p = await findDoctorPatient(ctx, patientId);
			return {
				proposal: {
					patientId: p.id,
					patientName: personDisplayName(p) || "Unknown patient",
					type,
					title,
					description,
				},
				warnings: [],
			};
		},
	},

	propose_appointment: {
		description:
			"Propose a new confirmed appointment for a patient. Check get_free_slots first when the doctor didn't give an exact time.",
		async propose(
			ctx,
			{ patientId, start, durationMinutes, name, description },
		) {
			const p = await findDoctorPatient(ctx, patientId);
			const startAt = fromPracticeTime(start);
			const endAt = new Date(startAt.getTime() + durationMinutes * MINUTE_MS);
			return {
				proposal: {
					patientId: p.id,
					patientName: personDisplayName(p) || "Unknown patient",
					start: startAt.toISOString(),
					end: endAt.toISOString(),
					name,
					description: description ?? "",
				},
				warnings: await scheduleWarnings(ctx, startAt, endAt),
			};
		},
	},

	propose_reschedule: {
		description:
			"Propose moving an existing appointment to a new time. Keeps its length unless a duration is given.",
		async propose(ctx, { appointmentId, start, durationMinutes }) {
			const row = await findDoctorAppointment(ctx, appointmentId);
			if (row.status === "cancelled") {
				throw new ToolError(`Appointment ${appointmentId} is cancelled.`);
			}
			const currentMinutes =
				row.start && row.end
					? Math.round((row.end.getTime() - row.start.getTime()) / MINUTE_MS)
					: 30;
			const startAt = fromPracticeTime(start);
			const endAt = new Date(
				startAt.getTime() + (durationMinutes ?? currentMinutes) * MINUTE_MS,
			);
			return {
				proposal: {
					appointment: toAiAppointment(row),
					start: startAt.toISOString(),
					end: endAt.toISOString(),
				},
				warnings: await scheduleWarnings(ctx, startAt, endAt, row.id),
			};
		},
	},
};
