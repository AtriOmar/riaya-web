import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { consultationRecording } from "@/db/schema";
import {
	generateRecordingInsights,
	type TranscriptResponse,
	transcribeAudio,
} from "@/lib/ai";
import { chargeRecordingUsage, getEffectivePlan } from "@/lib/plan-limits";
import { summarizeRecording } from "@/lib/recording-summary";
import {
	formatTranscriptForAiContext,
	transcriptSpeakers,
} from "@/lib/transcript";

function setStatus(recordingId: number, status: "processing" | "error") {
	return db
		.update(consultationRecording)
		.set({ transcriptStatus: status, updatedAt: new Date() })
		.where(eq(consultationRecording.id, recordingId));
}

/**
 * Works out who each speaker is and, if the recording has no title yet, names
 * it. Never throws: on failure speakers stay "Speaker N" and the recording
 * keeps its date-based name.
 */
async function analyzeRecording(recordingId: number, transcript: unknown) {
	try {
		const { title, speakerRoles } = await generateRecordingInsights(
			formatTranscriptForAiContext(transcript),
			transcriptSpeakers(transcript),
		);
		const [analyzed] = await db
			.update(consultationRecording)
			.set({
				speakerRoles,
				// Never overwrite a title the doctor gave
				...(title
					? { title: sql`coalesce(${consultationRecording.title}, ${title})` }
					: {}),
				updatedAt: new Date(),
			})
			.where(eq(consultationRecording.id, recordingId))
			.returning();
		return analyzed ?? null;
	} catch (err) {
		console.error("Recording analysis failed:", err);
		return null;
	}
}

/**
 * Audio length in whole seconds. Trusts the transcriber over the browser's
 * timer, so a client can't under-report what gets billed.
 */
function audioSeconds(
	transcript: TranscriptResponse,
	clientSeconds: number | null,
): number {
	const reported = Number(transcript.duration);
	if (Number.isFinite(reported) && reported > 0) return Math.ceil(reported);
	const lastSegmentEnd = Math.max(
		0,
		...transcript.segments.map((s) => Number(s.end) || 0),
	);
	return Math.ceil(Math.max(lastSegmentEnd, clientSeconds ?? 0));
}

/**
 * Downloads a recording's audio from the CDN, transcribes it and saves the
 * result. Status goes `processing` → `done` (or `error`). Returns the updated
 * row, or null when transcription failed. Ownership must be checked by the caller.
 */
export async function transcribeRecording(recordingId: number) {
	const [recording] = await db
		.select({
			doctorId: consultationRecording.doctorId,
			audioUrl: consultationRecording.audioUrl,
			durationSeconds: consultationRecording.durationSeconds,
		})
		.from(consultationRecording)
		.where(eq(consultationRecording.id, recordingId));
	if (!recording) return null;

	await setStatus(recordingId, "processing");

	try {
		const audioResponse = await fetch(recording.audioUrl);
		if (!audioResponse.ok) {
			throw new Error(`Audio fetch failed: ${audioResponse.status}`);
		}

		const arrayBuffer = await audioResponse.arrayBuffer();
		// Use arrayBuffer directly to avoid Node.js nested-Blob serialization issues
		const contentType = audioResponse.headers.get("content-type") ?? "";
		const audioMime = contentType.startsWith("audio/")
			? contentType
			: "audio/webm";
		const audioBlob = new Blob([arrayBuffer], { type: audioMime });
		const ext = recording.audioUrl.split(".").pop() ?? "webm";

		const transcript = await transcribeAudio(
			audioBlob,
			`recording-${recordingId}.${ext}`,
		);

		const durationSeconds = audioSeconds(transcript, recording.durationSeconds);

		const [updated] = await db
			.update(consultationRecording)
			.set({
				transcript,
				transcriptStatus: "done",
				durationSeconds,
				// Speaker numbers can change with a new transcript
				speakerRoles: null,
				updatedAt: new Date(),
			})
			.where(eq(consultationRecording.id, recordingId))
			.returning();

		// Who's speaking, and a title from what was said (unless the doctor gave one)
		const final = (await analyzeRecording(recordingId, transcript)) ?? updated;

		// The transcript is saved either way; a failed charge must not mark it as an error.
		await chargeRecordingUsage(
			recording.doctorId,
			recordingId,
			durationSeconds,
		).catch((err) => console.error("Recording usage charge failed:", err));
		return final;
	} catch (err) {
		console.error("Transcription error:", err);
		await setStatus(recordingId, "error");
		return null;
	}
}

/** The AI note runs after transcription when the doctor's plan includes it. */
export async function shouldSummarize(doctorId: number): Promise<boolean> {
	const { plan } = await getEffectivePlan(doctorId);
	return plan.canSummarizeRecordings;
}

/** Background job for a new recording: transcribe, then write the AI note (Pro). */
export async function transcribeAndSummarize(recordingId: number) {
	const transcribed = await transcribeRecording(recordingId);
	if (transcribed && (await shouldSummarize(transcribed.doctorId))) {
		await summarizeRecording(recordingId);
	}
}
