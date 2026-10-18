import { z } from "zod";
import { consultationSummarySchema } from "@/lib/consultation-summary";

// ─── AI chat message parts ────────────────────────────────────────────────────
// A message is a list of parts: text, a read tool the assistant ran (with the
// data its card shows), or an action it proposed (which runs only when the
// doctor confirms it). For each tool this file holds what the model sends
// (`input`) and what is stored and rendered (`result` / `proposal`). Zod only,
// so client components can import it.

// ─── Shared shapes ────────────────────────────────────────────────────────────

/** A local date in Africa/Tunis, `YYYY-MM-DD`. */
const localDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
/** A local date and time in Africa/Tunis, `YYYY-MM-DDTHH:mm`. */
const localDateTime = z
	.string()
	.regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Use YYYY-MM-DDTHH:mm");

export const aiAppointmentSchema = z.object({
	id: z.number(),
	start: z.string().nullable(),
	end: z.string().nullable(),
	status: z.string().nullable(),
	source: z.string(),
	urgent: z.boolean(),
	name: z.string().nullable(),
	description: z.string().nullable(),
	patientId: z.number().nullable(),
	patientName: z.string(),
});
export type AiAppointment = z.infer<typeof aiAppointmentSchema>;

export const aiPatientSchema = z.object({
	id: z.number(),
	firstName: z.string().nullable(),
	lastName: z.string().nullable(),
	cin: z.string().nullable(),
	dateOfBirth: z.string().nullable(),
});
export type AiPatient = z.infer<typeof aiPatientSchema>;

export const aiInvoiceSchema = z.object({
	id: z.number(),
	number: z.string(),
	status: z.string(),
	totalCentimes: z.number(),
	amountPaidCentimes: z.number(),
	issuedAt: z.string().nullable(),
	patientId: z.number(),
	patientName: z.string(),
});
export type AiInvoice = z.infer<typeof aiInvoiceSchema>;

const slotSchema = z.object({ start: z.string(), end: z.string() });

// ─── Read tools ───────────────────────────────────────────────────────────────

export const readToolSchemas = {
	get_schedule: {
		input: z.object({
			from: localDate.describe("First day, YYYY-MM-DD"),
			to: localDate.describe("Last day (inclusive), YYYY-MM-DD"),
		}),
		result: z.object({
			from: z.string(),
			to: z.string(),
			appointments: z.array(aiAppointmentSchema),
		}),
	},
	get_pending_bookings: {
		input: z.object({}),
		result: z.object({ appointments: z.array(aiAppointmentSchema) }),
	},
	search_patients: {
		input: z.object({
			query: z.string().min(1).describe("Name or CIN, or part of it"),
		}),
		result: z.object({
			query: z.string(),
			patients: z.array(aiPatientSchema),
		}),
	},
	get_patient_summary: {
		input: z.object({ patientId: z.coerce.number().int().positive() }),
		result: z.object({
			patient: aiPatientSchema.extend({ phoneNumber: z.string().nullable() }),
			appointments: z.array(aiAppointmentSchema),
			medicalFiles: z.array(
				z.object({
					id: z.number(),
					type: z.string().nullable(),
					title: z.string().nullable(),
					date: z.string().nullable(),
					description: z.string().nullable(),
				}),
			),
			recordings: z.array(
				z.object({
					id: z.number(),
					title: z.string().nullable(),
					date: z.string().nullable(),
					summary: consultationSummarySchema.nullable(),
				}),
			),
			unpaidInvoices: z.array(aiInvoiceSchema),
		}),
	},
	get_free_slots: {
		input: z.object({ date: localDate.describe("Day, YYYY-MM-DD") }),
		result: z.object({ date: z.string(), slots: z.array(slotSchema) }),
	},
	get_invoices: {
		input: z.object({
			status: z
				.enum(["unpaid", "partially_paid", "paid", "cancelled"])
				.optional(),
			patientId: z.coerce.number().int().positive().optional(),
		}),
		result: z.object({ invoices: z.array(aiInvoiceSchema) }),
	},
	get_practice_stats: {
		input: z.object({}),
		result: z.object({
			patients: z.number(),
			appointmentsToday: z.number(),
			appointmentsThisWeek: z.number(),
			pendingAppointments: z.number(),
			unpaidInvoices: z.number(),
			collectedThisMonthCentimes: z.number(),
			outstandingCentimes: z.number(),
		}),
	},
} as const;

// ─── Action tools (proposals) ─────────────────────────────────────────────────

export const MEDICAL_NOTE_TYPES = [
	"consultation",
	"prescription",
	"lab-report",
] as const;

const invoiceItemSchema = z.object({
	description: z.string().min(1),
	quantity: z.number().int().positive(),
	unitPriceCentimes: z.number().int().nonnegative(),
});

export const actionToolSchemas = {
	propose_invoice: {
		input: z.object({
			patientId: z.coerce.number().int().positive(),
			appointmentId: z.coerce.number().int().positive().optional(),
			items: z
				.array(
					z.object({
						description: z.string().min(1),
						quantity: z.coerce.number().int().positive().default(1),
						unitPriceTnd: z.coerce
							.number()
							.nonnegative()
							.describe("Price of one unit in TND, e.g. 60 or 12.5"),
					}),
				)
				.min(1),
			notes: z.string().optional(),
		}),
		proposal: z.object({
			patientId: z.number(),
			patientName: z.string(),
			appointmentId: z.number().nullable(),
			items: z.array(invoiceItemSchema).min(1),
			notes: z.string(),
		}),
	},
	propose_booking_decision: {
		input: z.object({
			appointmentId: z.coerce.number().int().positive(),
			decision: z.enum(["accept", "refuse"]),
		}),
		proposal: z.object({
			decision: z.enum(["accept", "refuse"]),
			appointment: aiAppointmentSchema,
			/** Accepting a phone booking with no patient file creates one with this name. */
			newPatient: z
				.object({ firstName: z.string(), lastName: z.string() })
				.nullable(),
		}),
	},
	propose_medical_note: {
		input: z.object({
			patientId: z.coerce.number().int().positive(),
			type: z.enum(MEDICAL_NOTE_TYPES),
			title: z.string().min(1),
			description: z.string().min(1).describe("The note itself"),
		}),
		proposal: z.object({
			patientId: z.number(),
			patientName: z.string(),
			type: z.enum(MEDICAL_NOTE_TYPES),
			title: z.string().min(1),
			description: z.string().min(1),
		}),
	},
	propose_appointment: {
		input: z.object({
			patientId: z.coerce.number().int().positive(),
			start: localDateTime.describe("Start, YYYY-MM-DDTHH:mm (Tunis time)"),
			durationMinutes: z.coerce.number().int().min(5).max(480).default(30),
			name: z.string().min(1).describe("Reason for the visit"),
			description: z.string().optional(),
		}),
		proposal: z.object({
			patientId: z.number(),
			patientName: z.string(),
			start: z.string(),
			end: z.string(),
			name: z.string().min(1),
			description: z.string(),
		}),
	},
	propose_reschedule: {
		input: z.object({
			appointmentId: z.coerce.number().int().positive(),
			start: localDateTime.describe("New start, YYYY-MM-DDTHH:mm (Tunis time)"),
			durationMinutes: z.coerce
				.number()
				.int()
				.min(5)
				.max(480)
				.optional()
				.describe("Leave out to keep the current length"),
		}),
		proposal: z.object({
			appointment: aiAppointmentSchema,
			start: z.string(),
			end: z.string(),
		}),
	},
} as const;

export type ReadToolName = keyof typeof readToolSchemas;
export type ActionToolName = keyof typeof actionToolSchemas;

export type ReadToolResult<N extends ReadToolName> = z.infer<
	(typeof readToolSchemas)[N]["result"]
>;
export type ActionProposal<N extends ActionToolName> = z.infer<
	(typeof actionToolSchemas)[N]["proposal"]
>;

// ─── Parts ────────────────────────────────────────────────────────────────────

export const AI_TOOL_STATUSES = ["running", "done", "error"] as const;
export const AI_ACTION_STATUSES = [
	"proposed",
	"confirmed",
	"dismissed",
	"failed",
] as const;

export const aiActionOutcomeSchema = z.object({
	kind: z.enum(["invoice", "appointment", "medical_file"]),
	id: z.number(),
	label: z.string(),
});
export type AiActionOutcome = z.infer<typeof aiActionOutcomeSchema>;

const textPart = z.object({ type: z.literal("text"), text: z.string() });

function toolPart<
	N extends ReadToolName,
	I extends z.ZodType,
	R extends z.ZodType,
>(name: N, schemas: { input: I; result: R }) {
	return z.object({
		type: z.literal("tool"),
		id: z.string(),
		name: z.literal(name),
		status: z.enum(AI_TOOL_STATUSES),
		args: schemas.input,
		result: schemas.result.optional(),
		error: z.string().optional(),
	});
}

function actionPart<N extends ActionToolName, P extends z.ZodType>(
	name: N,
	schemas: { proposal: P },
) {
	return z.object({
		type: z.literal("action"),
		id: z.string(),
		name: z.literal(name),
		status: z.enum(AI_ACTION_STATUSES),
		proposal: schemas.proposal,
		/** Things the doctor should know before confirming, e.g. an overlap. */
		warnings: z.array(z.string()),
		outcome: aiActionOutcomeSchema.optional(),
		error: z.string().optional(),
	});
}

export const aiToolPartSchema = z.discriminatedUnion("name", [
	toolPart("get_schedule", readToolSchemas.get_schedule),
	toolPart("get_pending_bookings", readToolSchemas.get_pending_bookings),
	toolPart("search_patients", readToolSchemas.search_patients),
	toolPart("get_patient_summary", readToolSchemas.get_patient_summary),
	toolPart("get_free_slots", readToolSchemas.get_free_slots),
	toolPart("get_invoices", readToolSchemas.get_invoices),
	toolPart("get_practice_stats", readToolSchemas.get_practice_stats),
]);

export const aiActionPartSchema = z.discriminatedUnion("name", [
	actionPart("propose_invoice", actionToolSchemas.propose_invoice),
	actionPart(
		"propose_booking_decision",
		actionToolSchemas.propose_booking_decision,
	),
	actionPart("propose_medical_note", actionToolSchemas.propose_medical_note),
	actionPart("propose_appointment", actionToolSchemas.propose_appointment),
	actionPart("propose_reschedule", actionToolSchemas.propose_reschedule),
]);

export const aiChatPartSchema = z.union([
	textPart,
	aiToolPartSchema,
	aiActionPartSchema,
]);

export type AiTextPart = z.infer<typeof textPart>;
export type AiToolPart = z.infer<typeof aiToolPartSchema>;
export type AiActionPart = z.infer<typeof aiActionPartSchema>;
export type AiChatPart = z.infer<typeof aiChatPartSchema>;

/** What the page receives while a reply is written, one JSON object per line. */
export type ReplyEvent =
	/** Text added to the reply (to its last part if that is text, else a new one). */
	| { type: "text"; delta: string }
	/** A tool or action part added or changed at `index`. */
	| { type: "part"; index: number; part: AiChatPart };

/** Applies one event to a reply's parts (server and page use the same rule). */
export function applyReplyEvent(
	parts: AiChatPart[],
	event: ReplyEvent,
): AiChatPart[] {
	if (event.type === "part") return parts.with(event.index, event.part);
	const last = parts.at(-1);
	return last?.type === "text"
		? parts.with(-1, { ...last, text: last.text + event.delta })
		: [...parts, { type: "text", text: event.delta }];
}

/** The message's text, for previews and copying. */
export function partsText(parts: AiChatPart[]): string {
	return parts
		.filter((p): p is AiTextPart => p.type === "text")
		.map((p) => p.text)
		.join("\n\n")
		.trim();
}
