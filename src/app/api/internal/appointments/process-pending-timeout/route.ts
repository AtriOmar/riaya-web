import { and, eq, gte } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { user } from "@/db/auth-schema";
import { appointment } from "@/db/schema";
import {
	apiError,
	json,
	requireInternal,
	validationError,
} from "@/lib/api-utils";
import { isPhoneBlocked } from "@/lib/blocked-phone";
import { advanceEmergencyGroup } from "@/lib/emergency-appointments";
import { registry } from "@/lib/openapi";
import { resolvePreferredLanguage } from "@/lib/person";
import { personDisplayName } from "@/lib/person-name";
import { getRefusalContext } from "@/lib/refusal-suggestions";
import {
	buildPendingTimeoutVoiceScript,
	buildPendingTimeoutWhatsappMessage,
	buildRefusalVoiceScript,
	buildRefusalWhatsappMessage,
} from "@/lib/whatsapp-messages";

const processSchema = z.discriminatedUnion("kind", [
	z.object({
		kind: z.literal("appointment"),
		appointmentId: z.number().int().positive(),
	}),
	z.object({
		kind: z.literal("refused"),
		appointmentId: z.number().int().positive(),
	}),
	z.object({
		kind: z.literal("emergency"),
		emergencyGroupId: z.string().min(1),
		/** The wave this timeout was scheduled for; missing on jobs queued before waves. */
		wave: z.number().int().positive().optional(),
	}),
]);

async function findAdminWhatsappUserId(): Promise<string | null> {
	const [admin] = await db
		.select({ id: user.id })
		.from(user)
		.where(gte(user.accessId, 3))
		.limit(1);
	return admin?.id ?? null;
}

function patientLabel(row: {
	contactPhone: string | null;
	person: { firstName: string | null; lastName: string | null } | null;
}): { name: string; phone: string | null } {
	return { name: personDisplayName(row.person), phone: row.contactPhone };
}

// ─── POST /api/internal/appointments/process-pending-timeout ─────────────────
// Called by the pending-timeout BullMQ worker when a request (or a wave of urgent ones) goes unanswered.

export async function POST(req: NextRequest) {
	try {
		requireInternal(req);
		const body = await req.json();
		const parsed = processSchema.safeParse(body);
		if (!parsed.success) return validationError(parsed.error.issues);

		const riayaPhone =
			process.env.TWILIO_PHONE_NUMBER?.trim() ||
			process.env.RIAYA_PHONE_NUMBER?.trim() ||
			null;

		// Doctor refused a normal AI request: row is already cancelled, just notify.
		if (parsed.data.kind === "refused") {
			const row = await db.query.appointment.findFirst({
				where: eq(appointment.id, parsed.data.appointmentId),
				with: { person: true },
			});

			if (!row) return json({ success: false, reason: "not_found" });
			if (row.status !== "cancelled" || row.source !== "ai" || row.urgent) {
				return json({ success: false, reason: "not_refused_ai_request" });
			}

			const { name, phone } = patientLabel(row);
			// Blocked numbers get no WhatsApp message or callback.
			if (!phone || (await isPhoneBlocked(phone))) {
				return json({ success: true, cancelled: true, notified: false });
			}

			const language = await resolvePreferredLanguage({ phone });
			const adminId = await findAdminWhatsappUserId();
			const context = await getRefusalContext(phone);
			const suggestions = (context?.suggestions ?? []).map((s) => ({
				name: s.name,
				start: new Date(s.slotStart),
				cabinetName: s.cabinetName,
			}));
			const voice = buildRefusalVoiceScript({
				language,
				patientName: name,
				riayaPhone,
				suggestions,
			});

			return json({
				success: true,
				cancelled: true,
				notified: true,
				phone,
				adminId,
				whatsappMessage: buildRefusalWhatsappMessage({
					language,
					patientName: name,
					riayaPhone,
					suggestions,
				}),
				voiceScript: voice.text,
				twilioLanguage: voice.twilioLanguage,
				riayaPhone,
			});
		}

		if (parsed.data.kind === "appointment") {
			const row = await db.query.appointment.findFirst({
				where: eq(appointment.id, parsed.data.appointmentId),
				with: { person: true },
			});

			if (!row) {
				return json({ success: false, reason: "not_found" });
			}
			if (row.status !== "pending" || row.source !== "ai") {
				return json({ success: false, reason: "not_pending" });
			}

			// Urgent siblings are handled by the emergency job; ignore stray appt jobs.
			if (row.urgent && row.emergencyGroupId) {
				return json({ success: false, reason: "handled_by_emergency_job" });
			}

			await db
				.update(appointment)
				.set({ status: "cancelled", updatedAt: new Date() })
				.where(
					and(eq(appointment.id, row.id), eq(appointment.status, "pending")),
				);

			const { name, phone } = patientLabel(row);
			// Blocked numbers get no WhatsApp message or callback.
			if (!phone || (await isPhoneBlocked(phone))) {
				return json({ success: true, cancelled: true, notified: false });
			}

			const language = await resolvePreferredLanguage({ phone });
			const adminId = await findAdminWhatsappUserId();
			const voice = buildPendingTimeoutVoiceScript({
				language,
				patientName: name,
				riayaPhone,
			});

			return json({
				success: true,
				cancelled: true,
				notified: true,
				phone,
				adminId,
				whatsappMessage: buildPendingTimeoutWhatsappMessage({
					language,
					patientName: name,
					riayaPhone,
				}),
				voiceScript: voice.text,
				twilioLanguage: voice.twilioLanguage,
				riayaPhone,
			});
		}

		// Emergency group: nobody in this wave accepted, so ask the next doctors.
		// The patient is told only once there is no next wave.
		const advance = await advanceEmergencyGroup({
			emergencyGroupId: parsed.data.emergencyGroupId,
			wave: parsed.data.wave,
		});
		if (advance.status === "skipped") {
			return json({ success: false, reason: advance.reason });
		}
		if (advance.status === "next_wave") {
			return json({
				success: true,
				cancelled: true,
				notified: false,
				nextWave: advance.wave,
			});
		}

		const { name, phone } = patientLabel(advance.patientRow);
		// Blocked numbers get no WhatsApp message or callback.
		if (!phone || (await isPhoneBlocked(phone))) {
			return json({ success: true, cancelled: true, notified: false });
		}

		const language = await resolvePreferredLanguage({ phone });
		const adminId = await findAdminWhatsappUserId();
		const voice = buildPendingTimeoutVoiceScript({
			language,
			patientName: name,
			riayaPhone,
		});

		return json({
			success: true,
			cancelled: true,
			notified: true,
			phone,
			adminId,
			whatsappMessage: buildPendingTimeoutWhatsappMessage({
				language,
				patientName: name,
				riayaPhone,
			}),
			voiceScript: voice.text,
			twilioLanguage: voice.twilioLanguage,
			riayaPhone,
		});
	} catch (e) {
		if (e instanceof Response) return e;
		console.error("[process-pending-timeout]", e);
		return apiError("INTERNAL_ERROR");
	}
}

registry.registerPath({
	method: "post",
	path: "/api/internal/appointments/process-pending-timeout",
	tags: ["Internal"],
	summary: "Auto-cancel unanswered AI pending appointments (Internal)",
	request: {
		body: {
			content: { "application/json": { schema: processSchema } },
		},
	},
	responses: {
		200: {
			description: "Processed",
			content: { "application/json": { schema: z.any() } },
		},
	},
});
