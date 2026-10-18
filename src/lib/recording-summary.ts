import { eq } from "drizzle-orm";
import { db } from "@/db";
import { consultationRecording } from "@/db/schema";
import { generateConsultationSummary } from "@/lib/ai";
import { formatTranscriptForAiContext } from "@/lib/transcript";

/**
 * Writes the AI consultation note for a transcribed recording and saves it.
 * Status goes `processing` → `done` (or `error`). Returns the updated row, or
 * null when it failed. Plan and ownership checks are the caller's job.
 */
export async function summarizeRecording(recordingId: number) {
	const [recording] = await db
		.select({
			transcript: consultationRecording.transcript,
			transcriptStatus: consultationRecording.transcriptStatus,
			speakerRoles: consultationRecording.speakerRoles,
		})
		.from(consultationRecording)
		.where(eq(consultationRecording.id, recordingId));
	if (!recording || recording.transcriptStatus !== "done") return null;

	// With roles, the note knows who said what (patient's symptoms vs doctor's plan)
	const text = formatTranscriptForAiContext(recording.transcript, {
		speakerRoles: recording.speakerRoles,
	});
	if (!text) return null;

	await db
		.update(consultationRecording)
		.set({ summaryStatus: "processing", updatedAt: new Date() })
		.where(eq(consultationRecording.id, recordingId));

	try {
		const { summary, usage } = await generateConsultationSummary(text);
		const [updated] = await db
			.update(consultationRecording)
			.set({
				summary,
				summaryStatus: "done",
				summaryCostMicroUsd: usage.costMicroUsd,
				updatedAt: new Date(),
			})
			.where(eq(consultationRecording.id, recordingId))
			.returning();
		return updated;
	} catch (err) {
		console.error("Recording summary failed:", err);
		await db
			.update(consultationRecording)
			.set({ summaryStatus: "error", updatedAt: new Date() })
			.where(eq(consultationRecording.id, recordingId));
		return null;
	}
}
