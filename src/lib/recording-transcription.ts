import { eq } from "drizzle-orm";
import { db } from "@/db";
import { consultationRecording } from "@/db/schema";
import { transcribeAudio } from "@/lib/ai";

function setStatus(recordingId: number, status: "processing" | "error") {
	return db
		.update(consultationRecording)
		.set({ transcriptStatus: status, updatedAt: new Date() })
		.where(eq(consultationRecording.id, recordingId));
}

/**
 * Downloads a recording's audio from the CDN, transcribes it and saves the
 * result. Status goes `processing` → `done` (or `error`). Returns the updated
 * row, or null when transcription failed. Ownership must be checked by the caller.
 */
export async function transcribeRecording(recordingId: number) {
	const [recording] = await db
		.select({ audioUrl: consultationRecording.audioUrl })
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

		const [updated] = await db
			.update(consultationRecording)
			.set({ transcript, transcriptStatus: "done", updatedAt: new Date() })
			.where(eq(consultationRecording.id, recordingId))
			.returning();
		return updated;
	} catch (err) {
		console.error("Transcription error:", err);
		await setStatus(recordingId, "error");
		return null;
	}
}
