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
import { cancelEmergencySiblingAppointments } from "@/lib/emergency-appointments";
import { registry } from "@/lib/openapi";
import { resolvePreferredLanguage } from "@/lib/person";
import {
	buildPendingTimeoutVoiceScript,
	buildPendingTimeoutWhatsappMessage,
} from "@/lib/whatsapp-messages";

const processSchema = z.discriminatedUnion("kind", [
	z.object({
		kind: z.literal("appointment"),
		appointmentId: z.number().int().positive(),
	}),
	z.object({
		kind: z.literal("emergency"),
		emergencyGroupId: z.string().min(1),
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
	newPatientName: string | null;
	newPatientPhoneNumber: string | null;
}): { name: string; phone: string | null } {
	return {
		name: row.newPatientName?.trim() || "",
		phone: row.newPatientPhoneNumber?.trim() || null,
	};
}

// ─── POST /api/internal/appointments/process-pending-timeout ─────────────────
// Called by the pending-timeout BullMQ worker after ~10 minutes unanswered.

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

		if (parsed.data.kind === "appointment") {
			const row = await db.query.appointment.findFirst({
				where: eq(appointment.id, parsed.data.appointmentId),
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
			if (!phone) {
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

		// Emergency group: cancel only if nobody accepted yet.
		const groupId = parsed.data.emergencyGroupId;
		const groupRows = await db.query.appointment.findMany({
			where: eq(appointment.emergencyGroupId, groupId),
		});

		if (groupRows.length === 0) {
			return json({ success: false, reason: "not_found" });
		}

		const anyConfirmed = groupRows.some((r) => r.status === "confirmed");
		if (anyConfirmed) {
			return json({ success: false, reason: "already_accepted" });
		}

		const pendingRows = groupRows.filter((r) => r.status === "pending");
		if (pendingRows.length === 0) {
			return json({ success: false, reason: "not_pending" });
		}

		await cancelEmergencySiblingAppointments({ emergencyGroupId: groupId });

		const sample = pendingRows[0];
		const { name, phone } = patientLabel(sample);
		if (!phone) {
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
			cancelledIds: pendingRows.map((r) => r.id),
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
