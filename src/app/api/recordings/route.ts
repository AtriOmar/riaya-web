import { and, desc, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { consultationRecording, patient } from "@/db/schema";
import {
	apiError,
	json,
	requireDoctorProfile,
	requireSession,
	validationError,
} from "@/lib/api-utils";

// ─── GET /api/recordings ──────────────────────────────────────────────────────
// Returns recordings for the authenticated doctor, optionally filtered by patient.

const listQuerySchema = z.object({
	patientId: z.coerce.number().int().positive().optional(),
});

export async function GET(req: NextRequest) {
	try {
		const session = await requireSession();
		const profile = await requireDoctorProfile(session.user.id);

		const searchParams = Object.fromEntries(req.nextUrl.searchParams);
		const parsed = listQuerySchema.safeParse(searchParams);
		if (!parsed.success) return validationError(parsed.error.issues);

		const conditions = [eq(consultationRecording.doctorId, profile.id)];
		if (parsed.data.patientId) {
			conditions.push(
				eq(consultationRecording.patientId, parsed.data.patientId),
			);
		}

		const recordings = await db
			.select({
				id: consultationRecording.id,
				doctorId: consultationRecording.doctorId,
				patientId: consultationRecording.patientId,
				title: consultationRecording.title,
				audioUrl: consultationRecording.audioUrl,
				durationSeconds: consultationRecording.durationSeconds,
				transcript: consultationRecording.transcript,
				transcriptStatus: consultationRecording.transcriptStatus,
				createdAt: consultationRecording.createdAt,
				updatedAt: consultationRecording.updatedAt,
				patient: {
					id: patient.id,
					firstName: patient.firstName,
					lastName: patient.lastName,
				},
			})
			.from(consultationRecording)
			.leftJoin(patient, eq(consultationRecording.patientId, patient.id))
			.where(and(...conditions))
			.orderBy(desc(consultationRecording.createdAt));

		return json(recordings);
	} catch (e) {
		if (e instanceof Response) return e;
		return apiError("INTERNAL_ERROR");
	}
}

// ─── POST /api/recordings ─────────────────────────────────────────────────────
// Creates a new recording row after the audio has been uploaded to R2.

const createSchema = z.object({
	audioUrl: z.url(),
	title: z.string().min(1).max(255),
	durationSeconds: z.number().int().positive().optional(),
	patientId: z.number().int().positive().optional(),
});

export async function POST(req: NextRequest) {
	try {
		const session = await requireSession();
		const profile = await requireDoctorProfile(session.user.id);

		const body = await req.json();
		const parsed = createSchema.safeParse(body);
		if (!parsed.success) return validationError(parsed.error.issues);

		// If patientId is provided, verify it belongs to this doctor
		if (parsed.data.patientId) {
			const [found] = await db
				.select({ id: patient.id })
				.from(patient)
				.where(
					and(
						eq(patient.id, parsed.data.patientId),
						eq(patient.doctorId, profile.id),
					),
				);
			if (!found) return apiError("PATIENT_NOT_FOUND");
		}

		const [recording] = await db
			.insert(consultationRecording)
			.values({
				doctorId: profile.id,
				patientId: parsed.data.patientId ?? null,
				title: parsed.data.title,
				audioUrl: parsed.data.audioUrl,
				durationSeconds: parsed.data.durationSeconds ?? null,
				transcriptStatus: "pending",
			})
			.returning();

		return json(recording, 201);
	} catch (e) {
		if (e instanceof Response) return e;
		return apiError("INTERNAL_ERROR");
	}
}

import {
	selectConsultationRecordingSchema,
	selectConsultationRecordingWithPatientSchema,
} from "@/db/zod";
import { registry } from "@/lib/openapi";

registry.registerPath({
	method: "get",
	path: "/api/recordings",
	tags: ["Recordings"],
	summary: "List doctor recordings",
	request: {
		query: listQuerySchema,
	},
	responses: {
		200: {
			description: "List of recordings with optional patient info",
			content: {
				"application/json": {
					schema: z.array(selectConsultationRecordingWithPatientSchema),
				},
			},
		},
	},
});

registry.registerPath({
	method: "post",
	path: "/api/recordings",
	tags: ["Recordings"],
	summary: "Create recording",
	request: {
		body: { content: { "application/json": { schema: createSchema } } },
	},
	responses: {
		201: {
			description: "Created recording",
			content: {
				"application/json": { schema: selectConsultationRecordingSchema },
			},
		},
	},
});
