import { and, eq } from "drizzle-orm";
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

type RouteContext = { params: Promise<{ id: string }> };

// ─── GET /api/recordings/[id] ─────────────────────────────────────────────────

export async function GET(_req: NextRequest, { params }: RouteContext) {
	try {
		const session = await requireSession();
		const profile = await requireDoctorProfile(session.user.id);

		const { id } = await params;
		const recordingId = Number(id);
		if (Number.isNaN(recordingId)) return apiError("INVALID_ID");

		const [recording] = await db
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
			.where(
				and(
					eq(consultationRecording.id, recordingId),
					eq(consultationRecording.doctorId, profile.id),
				),
			);

		if (!recording) return apiError("RECORDING_NOT_FOUND");

		return json(recording);
	} catch (e) {
		if (e instanceof Response) return e;
		return apiError("INTERNAL_ERROR");
	}
}

// ─── PATCH /api/recordings/[id] ───────────────────────────────────────────────

const patchSchema = z
	.object({
		title: z.string().min(1).max(255).optional(),
		patientId: z.number().int().positive().nullable().optional(),
	})
	.refine((d) => d.title !== undefined || d.patientId !== undefined, {
		message: "At least one field to update is required",
	});

export async function PATCH(req: NextRequest, { params }: RouteContext) {
	try {
		const session = await requireSession();
		const profile = await requireDoctorProfile(session.user.id);

		const { id } = await params;
		const recordingId = Number(id);
		if (Number.isNaN(recordingId)) return apiError("INVALID_ID");

		const body = await req.json();
		const parsed = patchSchema.safeParse(body);
		if (!parsed.success) return validationError(parsed.error.issues);

		// Verify the recording belongs to this doctor
		const [existing] = await db
			.select({ id: consultationRecording.id })
			.from(consultationRecording)
			.where(
				and(
					eq(consultationRecording.id, recordingId),
					eq(consultationRecording.doctorId, profile.id),
				),
			);
		if (!existing) return apiError("RECORDING_NOT_FOUND");

		// If patientId is being assigned, verify it belongs to this doctor
		if (parsed.data.patientId) {
			const [foundPatient] = await db
				.select({ id: patient.id })
				.from(patient)
				.where(
					and(
						eq(patient.id, parsed.data.patientId),
						eq(patient.doctorId, profile.id),
					),
				);
			if (!foundPatient) return apiError("PATIENT_NOT_FOUND");
		}

		const updateData: Record<string, unknown> = {
			updatedAt: new Date(),
		};
		if (parsed.data.title !== undefined) updateData.title = parsed.data.title;
		if (parsed.data.patientId !== undefined)
			updateData.patientId = parsed.data.patientId;

		const [updated] = await db
			.update(consultationRecording)
			.set(updateData)
			.where(eq(consultationRecording.id, recordingId))
			.returning();

		return json(updated);
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

const paramsSchema = z.object({ id: z.string() });

registry.registerPath({
	method: "get",
	path: "/api/recordings/{id}",
	tags: ["Recordings"],
	summary: "Get recording",
	request: { params: paramsSchema },
	responses: {
		200: {
			description: "Recording with patient info",
			content: {
				"application/json": {
					schema: selectConsultationRecordingWithPatientSchema,
				},
			},
		},
	},
});

registry.registerPath({
	method: "patch",
	path: "/api/recordings/{id}",
	tags: ["Recordings"],
	summary: "Update recording",
	request: {
		params: paramsSchema,
		body: { content: { "application/json": { schema: patchSchema } } },
	},
	responses: {
		200: {
			description: "Updated recording",
			content: {
				"application/json": { schema: selectConsultationRecordingSchema },
			},
		},
	},
});
