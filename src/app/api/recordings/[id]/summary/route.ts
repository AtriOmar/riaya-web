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
import { getEffectivePlan } from "@/lib/plan-limits";
import { summarizeRecording } from "@/lib/recording-summary";

type RouteContext = { params: Promise<{ id: string }> };

// ─── POST /api/recordings/[id]/summary ────────────────────────────────────────
// (Re)writes the AI consultation note from the transcript (Pro). Replaces any
// edits the doctor made. Covered by recording hours, so no extra limit.

export async function POST(_req: NextRequest, { params }: RouteContext) {
	try {
		const session = await requireSession();
		const profile = await requireDoctorProfile(session.user.id);

		const { id } = await params;
		const recordingId = Number(id);
		if (Number.isNaN(recordingId)) return apiError("INVALID_ID");

		const { plan } = await getEffectivePlan(profile.id);
		if (!plan.canSummarizeRecordings) {
			return apiError("SUMMARIES_REQUIRE_PRO");
		}

		const [recording] = await db
			.select({ transcriptStatus: consultationRecording.transcriptStatus })
			.from(consultationRecording)
			.where(
				and(
					eq(consultationRecording.id, recordingId),
					eq(consultationRecording.doctorId, profile.id),
				),
			);
		if (!recording) return apiError("RECORDING_NOT_FOUND");
		if (recording.transcriptStatus !== "done") {
			return apiError("TRANSCRIPT_REQUIRED");
		}

		const updated = await summarizeRecording(recordingId);
		if (!updated) return apiError("SUMMARY_FAILED");

		return json(updated);
	} catch (e) {
		if (e instanceof Response) return e;
		return apiError("INTERNAL_ERROR");
	}
}

import { selectConsultationRecordingSchema } from "@/db/zod";
import { registry } from "@/lib/openapi";

registry.registerPath({
	method: "post",
	path: "/api/recordings/{id}/summary",
	tags: ["Recordings"],
	summary: "Write the AI consultation note",
	request: { params: z.object({ id: z.string() }) },
	responses: {
		200: {
			description: "Recording with its new summary",
			content: {
				"application/json": { schema: selectConsultationRecordingSchema },
			},
		},
	},
});
