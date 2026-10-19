import crypto from "node:crypto";
import { and, eq, gte } from "drizzle-orm";
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
import { REVIEW_REQUEST_DELAY_MS } from "@/lib/review-scheduling";
import { buildReviewWhatsappMessage } from "@/lib/whatsapp-messages";

const REVIEW_LINK_TTL_MS = 30 * 24 * 60 * 60 * 1000;
/** Minimum gap between review requests to one patient for one doctor. */
const REVIEW_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000;

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

		if (!appt) {
			return json({ success: false, reason: "appointment_not_found" });
		}

		// Appointments only have pending | confirmed | cancelled (no no-show
		// status). Only a confirmed one means the visit was accepted and
		// plausibly happened; pending was never accepted, cancelled never took place.
		if (appt.status !== "confirmed") {
			return json({ success: false, reason: "appointment_not_confirmed" });
		}

		// A rescheduled visit may still be ahead of this (stale) job.
		if (
			!appt.end ||
			appt.end.getTime() + REVIEW_REQUEST_DELAY_MS > Date.now()
		) {
			return json({ success: false, reason: "appointment_not_finished" });
		}

		// 2. One review per appointment.
		const existingReview = await db.query.review.findFirst({
			where: eq(review.appointmentId, appointmentId),
		});
		if (existingReview) {
			return json({ success: false, reason: "review_already_exists" });
		}

		// Cooldown: don't ask the same patient about the same doctor again soon,
		// whether or not they answered the earlier request.
		if (patientId) {
			const recentRequest = await db.query.review.findFirst({
				where: and(
					eq(review.doctorId, doctorId),
					eq(review.patientId, patientId),
					gte(review.createdAt, new Date(Date.now() - REVIEW_COOLDOWN_MS)),
				),
			});
			if (recentRequest) {
				return json({ success: false, reason: "review_recently_requested" });
			}
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
			expiresAt: new Date(Date.now() + REVIEW_LINK_TTL_MS),
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
