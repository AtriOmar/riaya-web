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
import { transcribeAudio } from "@/lib/azure-ai";

type RouteContext = { params: Promise<{ id: string }> };

// ─── POST /api/recordings/[id]/transcribe ─────────────────────────────────────
// Triggers transcription for a recording via `transcribeAudio` in azure-ai.ts.

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
		if (recording.transcriptStatus === "done")
			return apiError("TRANSCRIPT_ALREADY_DONE");

		// Mark as processing
		await db
			.update(consultationRecording)
			.set({ transcriptStatus: "processing", updatedAt: new Date() })
			.where(eq(consultationRecording.id, recordingId));

		// Fetch the audio from the CDN
		const audioResponse = await fetch(recording.audioUrl);
		if (!audioResponse.ok) {
			await db
				.update(consultationRecording)
				.set({ transcriptStatus: "error", updatedAt: new Date() })
				.where(eq(consultationRecording.id, recordingId));
			return apiError("TRANSCRIPTION_FAILED");
		}

		const arrayBuffer = await audioResponse.arrayBuffer();
		// Use arrayBuffer directly to avoid Node.js nested-Blob serialization issues
		const contentType = audioResponse.headers.get("content-type") ?? "";
		const audioMime = contentType.startsWith("audio/")
			? contentType
			: "audio/webm";
		const audioBlob = new Blob([arrayBuffer], { type: audioMime });
		const ext = recording.audioUrl.split(".").pop() ?? "webm";
		const filename = `recording-${recordingId}.${ext}`;

		let transcript: any;
		try {
			transcript = await transcribeAudio(audioBlob, filename);
		} catch (err) {
			await db
				.update(consultationRecording)
				.set({ transcriptStatus: "error", updatedAt: new Date() })
				.where(eq(consultationRecording.id, recordingId));
			console.error("Transcription error:", err);
			return apiError("TRANSCRIPTION_FAILED");
		}

		// Save transcript
		const [updated] = await db
			.update(consultationRecording)
			.set({
				transcript,
				transcriptStatus: "done",
				updatedAt: new Date(),
			})
			.where(eq(consultationRecording.id, recordingId))
			.returning();

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
