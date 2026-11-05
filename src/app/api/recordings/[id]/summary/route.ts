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
	validationError,
} from "@/lib/api-utils";
import { languages } from "@/lib/language";
import { getEffectivePlan } from "@/lib/plan-limits";
import { summarizeRecording } from "@/lib/recording-summary";

type RouteContext = { params: Promise<{ id: string }> };

// ─── POST /api/recordings/[id]/summary ────────────────────────────────────────
// (Re)writes the AI consultation note from the transcript (Pro). Replaces any
// edits the doctor made. Covered by recording hours, so no extra limit. The body
// is optional: `language` writes this note in another language than the
// doctor's default.

const summaryBodySchema = z.object({ language: z.enum(languages).optional() });

export async function POST(req: NextRequest, { params }: RouteContext) {
	try {
		const session = await requireSession();
		const profile = await requireDoctorProfile(session.user.id);

		// An empty body means the doctor's default language
		const body = await req.json().catch(() => ({}));
		const parsed = summaryBodySchema.safeParse(body);
		if (!parsed.success) return validationError(parsed.error.issues);

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

		const updated = await summarizeRecording(recordingId, parsed.data.language);
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
	request: {
		params: z.object({ id: z.string() }),
		body: {
			required: false,
			content: { "application/json": { schema: summaryBodySchema } },
		},
	},
	responses: {
		200: {
			description: "Recording with its new summary",
			content: {
				"application/json": { schema: selectConsultationRecordingSchema },
			},
		},
	},
});
