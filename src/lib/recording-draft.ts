import { delIDB, getIDB, setIDB } from "@/lib/idb";

/**
 * A copy of the recording in progress, kept in this browser's IndexedDB so a
 * closed tab, refresh or crash doesn't lose the consultation. Audio is stored
 * in numbered pieces (rewriting one growing blob would get slower and slower);
 * joining them gives the same file the recorder would have produced.
 */
export type RecordingDraft = {
	startedAt: string;
	mimeType: string;
	durationSeconds: number;
	title: string;
	patientId: number | null;
	pieces: number;
};

const META_KEY = "recording-draft:meta";
const pieceKey = (index: number) => `recording-draft:piece:${index}`;

export async function loadRecordingDraft(): Promise<RecordingDraft | null> {
	try {
		const meta = await getIDB<RecordingDraft>(META_KEY);
		return meta && meta.pieces > 0 ? meta : null;
	} catch {
		return null;
	}
}

/** Saves the next piece of audio and the latest details. */
export async function saveRecordingDraftPiece(
	index: number,
	audio: Blob,
	meta: Omit<RecordingDraft, "pieces">,
): Promise<void> {
	try {
		await setIDB(pieceKey(index), audio);
		await setIDB(META_KEY, { ...meta, pieces: index + 1 });
	} catch (err) {
		// Storage full or blocked: the recording itself carries on
		console.error("Couldn't back up the recording locally:", err);
	}
}

/** The whole recording so far, as one audio file. */
export async function loadRecordingDraftAudio(
	draft: RecordingDraft,
): Promise<Blob> {
	const pieces = await Promise.all(
		Array.from({ length: draft.pieces }, (_, i) => getIDB<Blob>(pieceKey(i))),
	);
	return new Blob(
		pieces.filter((p): p is Blob => p instanceof Blob),
		{ type: draft.mimeType },
	);
}

export async function clearRecordingDraft(): Promise<void> {
	try {
		const meta = await getIDB<RecordingDraft>(META_KEY);
		await delIDB(META_KEY);
		const count = meta?.pieces ?? 0;
		await Promise.all(
			Array.from({ length: count }, (_, i) => delIDB(pieceKey(i))),
		);
	} catch (err) {
		console.error("Couldn't clear the local recording copy:", err);
	}
}

// A recorder on this page owns the current draft while it's recording or
// saving, so the recovery banner doesn't offer it as "unsaved".
let activeInThisPage = false;

export function setRecordingDraftActive(active: boolean): void {
	activeInThisPage = active;
}

export function isRecordingDraftActive(): boolean {
	return activeInThisPage;
}
