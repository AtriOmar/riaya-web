import { and, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { consultationRecording } from "@/db/schema";
import {
	apiError,
	json,
	requireDoctorProfile,
	requireSession,
} from "@/lib/api-utils";
import { transcribeRecording } from "@/lib/recording-transcription";

type RouteContext = { params: Promise<{ id: string }> };

// ─── POST /api/recordings/[id]/transcribe ─────────────────────────────────────
// Re-runs transcription for a recording (new recordings are transcribed
// automatically on create, so this is for retries).

export async function POST(_req: NextRequest, { params }: RouteContext) {
	try {
		const session = await requireSession();
		const profile = await requireDoctorProfile(session.user.id);

		const { id } = await params;
		const recordingId = Number(id);
		if (Number.isNaN(recordingId)) return apiError("INVALID_ID");

		// Fetch the recording and verify ownership
		const [recording] = await db
			.select()
			.from(consultationRecording)
			.where(
				and(
					eq(consultationRecording.id, recordingId),
					eq(consultationRecording.doctorId, profile.id),
				),
			);

		if (!recording) return apiError("RECORDING_NOT_FOUND");

		const updated = await transcribeRecording(recordingId);
		if (!updated) return apiError("TRANSCRIPTION_FAILED");

		return json(updated);
	} catch (e) {
		if (e instanceof Response) return e;
		return apiError("INTERNAL_ERROR");
	}
}

import { selectConsultationRecordingSchema } from "@/db/zod";
import { registry } from "@/lib/openapi";

const paramsSchema = z.object({ id: z.string() });

registry.registerPath({
	method: "post",
	path: "/api/recordings/{id}/transcribe",
	tags: ["Recordings"],
	summary: "Transcribe recording",
	request: { params: paramsSchema },
	responses: {
		200: {
			description: "Recording with transcript",
			content: {
				"application/json": { schema: selectConsultationRecordingSchema },
			},
		},
	},
});
