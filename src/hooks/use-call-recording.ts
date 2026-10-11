"use client";

/**
 * useCallRecording
 *
 * Records a browser test call (mic + AI voice mixed into one track), uploads it
 * to R2 and saves the URL on the simulated call row. Real Twilio calls are
 * recorded server-side instead (see /api/calls/recording-webhook).
 *
 * Usage: `start()` once the call is live, `addStream()` for every audio source
 * (it can be called before `start`), `stop(callSid)` when the call ends and
 * `reset()` to discard. The local blob URL is available right after `stop`, so
 * the UI can play it without waiting for the upload.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { uploadToR2 } from "@/lib/upload";
import { usePostApiTestCallRecording } from "@/services/generated/test-call/test-call";

export type RecordingStatus =
	| "idle"
	| "recording"
	| "saving"
	| "saved"
	| "error";

const MIME_CANDIDATES = [
	{ mime: "audio/webm;codecs=opus", type: "audio/webm", ext: "webm" },
	{ mime: "audio/webm", type: "audio/webm", ext: "webm" },
	{ mime: "audio/mp4", type: "audio/mp4", ext: "mp4" },
];

function pickFormat() {
	if (typeof MediaRecorder === "undefined") return null;
	return MIME_CANDIDATES.find((c) => MediaRecorder.isTypeSupported(c.mime));
}

type Session = {
	ctx: AudioContext;
	dest: MediaStreamAudioDestinationNode;
	recorder: MediaRecorder;
	chunks: Blob[];
	format: { mime: string; type: string; ext: string };
};

export function useCallRecording() {
	const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
	const [recordingStatus, setRecordingStatus] =
		useState<RecordingStatus>("idle");
	const { trigger: saveRecording } = usePostApiTestCallRecording();
	const saveRef = useRef(saveRecording);
	saveRef.current = saveRecording;

	const sessionRef = useRef<Session | null>(null);
	/** Streams added before `start()`, e.g. the agent's first audio track. */
	const pendingRef = useRef<MediaStream[]>([]);
	const sourcesRef = useRef<MediaStreamAudioSourceNode[]>([]);
	const lastRef = useRef<{ file: File; callSid: string } | null>(null);
	const blobUrlRef = useRef<string | null>(null);

	const connect = useCallback((stream: MediaStream) => {
		const session = sessionRef.current;
		if (!session || stream.getAudioTracks().length === 0) return;
		try {
			const source = session.ctx.createMediaStreamSource(stream);
			source.connect(session.dest);
			sourcesRef.current.push(source);
		} catch {
			// a dead track must not break the call
		}
	}, []);

	const closeSession = useCallback(() => {
		const session = sessionRef.current;
		sessionRef.current = null;
		for (const s of sourcesRef.current) {
			try {
				s.disconnect();
			} catch {}
		}
		sourcesRef.current = [];
		try {
			void session?.ctx.close();
		} catch {}
	}, []);

	const save = useCallback(async (file: File, callSid: string) => {
		setRecordingStatus("saving");
		try {
			const recordingUrl = await uploadToR2(file, "test-call-recordings");
			await saveRef.current({ callSid, recordingUrl });
			setRecordingStatus("saved");
		} catch {
			setRecordingStatus("error");
		}
	}, []);

	const reset = useCallback(() => {
		const session = sessionRef.current;
		if (session && session.recorder.state !== "inactive") {
			session.recorder.ondataavailable = null;
			session.recorder.onstop = null;
			try {
				session.recorder.stop();
			} catch {}
		}
		closeSession();
		pendingRef.current = [];
		lastRef.current = null;
		if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
		blobUrlRef.current = null;
		setRecordingUrl(null);
		setRecordingStatus("idle");
	}, [closeSession]);

	const start = useCallback(() => {
		if (sessionRef.current) return;
		const format = pickFormat();
		if (!format) return; // unsupported browser: the call still works
		try {
			const ctx = new AudioContext();
			const dest = ctx.createMediaStreamDestination();
			const recorder = new MediaRecorder(dest.stream, {
				mimeType: format.mime,
			});
			const chunks: Blob[] = [];
			recorder.ondataavailable = (e) => {
				if (e.data.size > 0) chunks.push(e.data);
			};
			sessionRef.current = { ctx, dest, recorder, chunks, format };
			for (const stream of pendingRef.current) connect(stream);
			pendingRef.current = [];
			recorder.start(1000);
			setRecordingStatus("recording");
		} catch {
			closeSession();
		}
	}, [connect, closeSession]);

	const addStream = useCallback(
		(stream: MediaStream) => {
			if (sessionRef.current) connect(stream);
			else pendingRef.current.push(stream);
		},
		[connect],
	);

	/** Finishes the recording, then uploads it and saves it on the call row. */
	const stop = useCallback(
		(callSid: string | null) => {
			const session = sessionRef.current;
			if (!session) return;
			sessionRef.current = null;
			const { recorder, chunks, format } = session;
			recorder.onstop = () => {
				// sessionRef is already cleared, so close the audio graph here.
				for (const s of sourcesRef.current) {
					try {
						s.disconnect();
					} catch {}
				}
				sourcesRef.current = [];
				try {
					void session.ctx.close();
				} catch {}

				const blob = new Blob(chunks, { type: format.type });
				if (blob.size === 0) {
					setRecordingStatus("idle");
					return;
				}
				if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
				blobUrlRef.current = URL.createObjectURL(blob);
				setRecordingUrl(blobUrlRef.current);

				if (!callSid) {
					setRecordingStatus("error");
					return;
				}
				const file = new File([blob], `${callSid}.${format.ext}`, {
					type: format.type,
				});
				lastRef.current = { file, callSid };
				void save(file, callSid);
			};
			if (recorder.state === "inactive")
				recorder.onstop?.call(recorder, new Event("stop"));
			else recorder.stop();
		},
		[save],
	);

	const retrySave = useCallback(() => {
		const last = lastRef.current;
		if (last) void save(last.file, last.callSid);
	}, [save]);

	// Discard on unmount (an in-flight upload is not interrupted).
	useEffect(() => reset, [reset]);

	return {
		recordingUrl,
		recordingStatus,
		start,
		addStream,
		stop,
		reset,
		retrySave,
	};
}
