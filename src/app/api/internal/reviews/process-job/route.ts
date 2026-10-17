import crypto from "node:crypto";
import { and, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { appointment, doctorProfile, review } from "@/db/schema";
import {
	apiError,
	json,
	requireInternal,
	validationError,
} from "@/lib/api-utils";
import { registry } from "@/lib/openapi";
import { resolvePreferredLanguage } from "@/lib/person";
import { personDisplayName } from "@/lib/person-name";
import { buildReviewWhatsappMessage } from "@/lib/whatsapp-messages";

const processJobSchema = z.object({
	appointmentId: z.number().int().positive(),
	doctorId: z.number().int().positive(),
	patientId: z.number().int().positive().nullable().optional(),
});

export async function POST(req: NextRequest) {
	try {
		requireInternal(req);
		const body = await req.json();
		const parsed = processJobSchema.safeParse(body);

		if (!parsed.success) return validationError(parsed.error.issues);

		const { appointmentId, doctorId, patientId } = parsed.data;

		// 1. Fetch appointment
		const appt = await db.query.appointment.findFirst({
			where: eq(appointment.id, appointmentId),
			with: { patient: true, person: true },
		});

		// Only send if it was not cancelled
		if (!appt || appt.status === "cancelled") {
			return json({ success: false, reason: "appointment_cancelled" });
		}

		// 2. Check if a review already exists for this patient + doctor (or for this appointment if no patientId)
		const existingReview = await db.query.review.findFirst({
			where: patientId
				? and(eq(review.doctorId, doctorId), eq(review.patientId, patientId))
				: eq(review.appointmentId, appointmentId),
		});

		if (existingReview) {
			return json({ success: false, reason: "review_already_exists" });
		}

		// 3. Get phone, name, and doctor info. Messages go to the line that booked.
		const phone = appt.contactPhone ?? appt.patient?.phoneNumber ?? null;
		const patientName =
			personDisplayName(appt.patient) || personDisplayName(appt.person);

		const doc = await db.query.doctorProfile.findFirst({
			where: eq(doctorProfile.id, doctorId),
			with: { user: true },
		});

		if (!phone) {
			return json({ success: false, reason: "no_phone_number" });
		}

		// The message goes to the phone line, so use its owner's language.
		const language = await resolvePreferredLanguage({ phone });

		// 4. Create review row
		const token = crypto.randomUUID();
		await db.insert(review).values({
			appointmentId,
			doctorId,
			patientId: patientId ?? null,
			token,
			status: "pending",
		});

		const doctorName = doc?.lastName ? `Dr. ${doc.lastName}` : "your doctor";
		const appUrl =
			process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
			"http://localhost:3000";
		const message = buildReviewWhatsappMessage({
			language,
			patientName,
			doctorFirstName: doc?.firstName,
			doctorLastName: doc?.lastName,
			link: `${appUrl}/review/${token}`,
		});

		return json({
			success: true,
			token,
			phone,
			patientName,
			doctorName,
			adminId: doc?.userId,
			message,
			preferredLanguage: language,
		});
	} catch (e) {
		if (e instanceof Response) return e;
		console.error("Failed to process review job:", e);
		return apiError("INTERNAL_ERROR");
	}
}

registry.registerPath({
	method: "post",
	path: "/api/internal/reviews/process-job",
	tags: ["Internal"],
	summary: "Process a delayed review job (Internal)",
	request: {
		body: {
			content: {
				"application/json": {
					schema: processJobSchema,
				},
			},
		},
	},
	responses: {
		200: {
			description: "Job processed",
			content: {
				"application/json": {
					schema: z.any(), // Internal dynamic response
				},
			},
		},
	},
});
