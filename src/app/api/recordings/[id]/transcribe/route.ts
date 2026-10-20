import { and, eq } from "drizzle-orm";
import { after, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { consultationRecording, recordingUsage } from "@/db/schema";
import {
	apiError,
	json,
	requireDoctorProfile,
	requireSession,
} from "@/lib/api-utils";
import { getRecordingTime } from "@/lib/plan-limits";
import { summarizeRecording } from "@/lib/recording-summary";
import {
	shouldSummarize,
	transcribeRecording,
} from "@/lib/recording-transcription";

type RouteContext = { params: Promise<{ id: string }> };

// ─── POST /api/recordings/[id]/transcribe ─────────────────────────────────────
// Transcribes a recording: a retry, or one saved while no recording time was
// left. A recording's time is only charged once, so retries are free; a first
// transcription needs time left. On Pro the AI note follows in the background.

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

		const [charged] = await db
			.select({ id: recordingUsage.id })
			.from(recordingUsage)
			.where(eq(recordingUsage.recordingId, recordingId));
		if (!charged) {
			const { remainingSeconds } = await getRecordingTime(profile.id);
			if (remainingSeconds <= 0) return apiError("RECORDING_LIMIT_REACHED");
		}

		const transcribed = await transcribeRecording(recordingId);
		if (!transcribed) return apiError("TRANSCRIPTION_FAILED");

		if (!(await shouldSummarize(profile.id))) return json(transcribed);

		// Mark it now so the page starts polling, then write the note after responding
		const [updated] = await db
			.update(consultationRecording)
			.set({ summaryStatus: "processing" })
			.where(eq(consultationRecording.id, recordingId))
			.returning();
		after(() => summarizeRecording(recordingId));
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
