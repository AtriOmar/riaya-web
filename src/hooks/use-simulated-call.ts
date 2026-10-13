"use client";

/**
 * useSimulatedCall
 *
 * Browser hook that impersonates the Twilio Media Stream protocol so the
 * existing voice pipeline (OpenAI Realtime, tools, DB rows, Live Calls
 * dashboard) runs without a real phone or Twilio account.
 *
 * Flow:
 *  1. getUserMedia  → mic stream (echoCancellation on)
 *  2. ScriptProcessorNode  → downsample native rate → 8 kHz PCM frames
 *  3. encodeUlawToBase64  → µ-law base64
 *  4. WebSocket /media-stream: connected → start → media (20 ms / 160-byte frames)
 *  5. Inbound media: decode µ-law → play via AudioContext @ 8 kHz
 *  6. Inbound clear: flush playback queue (barge-in)
 *  7. Echo inbound mark back to server (keeps TwilioSession mark-queue intact)
 *  8. Hang up: send stop + close WS  (or server closes WS after end_call)
 *
 * Audio format:  G.711 µ-law, 8000 Hz mono, base64 payload
 * Frame size:    160 samples = 20 ms @ 8 kHz
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
	type RecordingStatus,
	useCallRecording,
} from "@/hooks/use-call-recording";
import {
	type TranscriptLine,
	useCallTranscript,
} from "@/hooks/use-call-transcript";
import type { CallSettings } from "@/lib/call-settings-schema";
import { decodeUlaw, encodeUlawToBase64 } from "@/lib/ulaw";
import { usePostApiTestCallSettings } from "@/services/generated/test-call/test-call";

export type { TranscriptLine };

// ─── Types ────────────────────────────────────────────────────────────────────

export type SimulatedCallStatus =
	| "idle"
	| "requesting-mic"
	| "connecting"
	| "in-call"
	| "ended"
	| "error";

export type SimulatedCallState = {
	status: SimulatedCallStatus;
	callSid: string | null;
	error: string | null;
	transcript: TranscriptLine[];
	/** Local playable URL of the call recording, once the call has ended. */
	recordingUrl: string | null;
	recordingStatus: RecordingStatus;
	retryRecordingSave: () => void;
	startCall: (phoneNumber: string, settings?: CallSettings) => Promise<void>;
	hangUp: () => void;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const FRAME_SAMPLES = 160; // 20 ms @ 8 kHz
const TARGET_SAMPLE_RATE = 8000;

function makeSid(prefix: string): string {
	return `${prefix}${Math.random().toString(36).slice(2, 12).toUpperCase()}`;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useSimulatedCall(): SimulatedCallState {
	const [status, setStatus] = useState<SimulatedCallStatus>("idle");
	const [callSid, setCallSid] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const {
		transcript,
		connect: connectDashboard,
		disconnect: disconnectDashboard,
		reset: resetTranscript,
	} = useCallTranscript();
	const {
		recordingUrl,
		recordingStatus,
		start: startRecording,
		addStream: addRecordingStream,
		stop: stopRecording,
		reset: resetRecording,
		retrySave: retryRecordingSave,
	} = useCallRecording();

	// WebSocket to /media-stream
	const wsRef = useRef<WebSocket | null>(null);
	// Current callSid in a ref so closures can read it without stale state
	const callSidRef = useRef<string | null>(null);

	// Audio capture
	const captureCtxRef = useRef<AudioContext | null>(null);
	const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
	const micStreamRef = useRef<MediaStream | null>(null);

	// Audio playback (AI voice)
	const playCtxRef = useRef<AudioContext | null>(null);
	const nextPlayTimeRef = useRef(0);
	// Tap on the AI voice for the call recording, and the chunks still scheduled
	// (so barge-in can cut them without closing the context the tap lives in).
	const playDestRef = useRef<MediaStreamAudioDestinationNode | null>(null);
	const scheduledRef = useRef<Set<AudioBufferSourceNode>>(new Set());
	// Marks waiting for their audio to finish playing. Twilio only echoes a mark
	// once the media before it has played; the server relies on that to know the
	// caller is still hearing the reply (and so whether barge-in must clear it).
	const pendingMarksRef = useRef<
		Map<ReturnType<typeof setTimeout>, () => void>
	>(new Map());

	// Outgoing media timestamp counter (ms)
	const timestampRef = useRef(0);

	// PCM sample accumulator for the current frame
	const pcmBufferRef = useRef<Float32Array>(new Float32Array(0));

	// ─── Cleanup ───────────────────────────────────────────────────────────────

	const stopCapture = useCallback(() => {
		try {
			scriptProcessorRef.current?.disconnect();
		} catch {}
		scriptProcessorRef.current = null;

		try {
			captureCtxRef.current?.close();
		} catch {}
		captureCtxRef.current = null;

		for (const t of micStreamRef.current?.getTracks() ?? []) t.stop();
		micStreamRef.current = null;

		pcmBufferRef.current = new Float32Array(0);
		timestampRef.current = 0;
	}, []);

	const stopPlayback = useCallback(() => {
		for (const timer of pendingMarksRef.current.keys()) clearTimeout(timer);
		pendingMarksRef.current.clear();
		try {
			playCtxRef.current?.close();
		} catch {}
		playCtxRef.current = null;
		playDestRef.current = null;
		scheduledRef.current.clear();
		nextPlayTimeRef.current = 0;
	}, []);

	const closeWs = useCallback((ws: WebSocket | null) => {
		if (!ws) return;
		try {
			if (ws.readyState === WebSocket.OPEN) ws.close();
		} catch {}
	}, []);

	// ─── Playback helpers ──────────────────────────────────────────────────────

	const ensurePlayContext = useCallback(() => {
		if (!playCtxRef.current || playCtxRef.current.state === "closed") {
			const ctx = new AudioContext({ sampleRate: TARGET_SAMPLE_RATE });
			playCtxRef.current = ctx;
			playDestRef.current = ctx.createMediaStreamDestination();
			scheduledRef.current.clear();
			nextPlayTimeRef.current = ctx.currentTime;
		}
		return playCtxRef.current;
	}, []);

	const playAiChunk = useCallback(
		(base64Payload: string) => {
			try {
				const ctx = ensurePlayContext();
				if (ctx.state === "closed") return;

				// Resume if suspended (autoplay policy)
				if (ctx.state === "suspended") {
					void ctx.resume();
				}

				const pcm = decodeUlaw(base64Payload);
				const buffer = ctx.createBuffer(1, pcm.length, TARGET_SAMPLE_RATE);
				buffer.getChannelData(0).set(pcm);
				const source = ctx.createBufferSource();
				source.buffer = buffer;
				source.connect(ctx.destination);
				if (playDestRef.current) source.connect(playDestRef.current);
				const scheduled = scheduledRef.current;
				scheduled.add(source);
				source.onended = () => scheduled.delete(source);
				const now = ctx.currentTime;
				if (nextPlayTimeRef.current < now) nextPlayTimeRef.current = now;
				source.start(nextPlayTimeRef.current);
				nextPlayTimeRef.current += buffer.duration;
			} catch {
				// ignore decode/play errors
			}
		},
		[ensurePlayContext],
	);

	const flushPlaybackQueue = useCallback(() => {
		// Stop every scheduled chunk but keep the context alive: the recording
		// tap is attached to it.
		for (const source of scheduledRef.current) {
			try {
				source.stop();
			} catch {}
		}
		scheduledRef.current.clear();
		nextPlayTimeRef.current = playCtxRef.current?.currentTime ?? 0;
	}, []);

	// ─── Send helpers ──────────────────────────────────────────────────────────

	const sendJson = useCallback((data: unknown) => {
		const ws = wsRef.current;
		if (ws?.readyState === WebSocket.OPEN) {
			ws.send(JSON.stringify(data));
		}
	}, []);

	const sendMediaFrame = useCallback(
		(base64Payload: string, streamSid: string) => {
			const ts = timestampRef.current;
			timestampRef.current += 20; // 20 ms per frame
			sendJson({
				event: "media",
				sequenceNumber: String(timestampRef.current / 20),
				streamSid,
				media: {
					track: "inbound",
					chunk: String(timestampRef.current / 20),
					timestamp: String(ts),
					payload: base64Payload,
				},
			});
		},
		[sendJson],
	);

	// ─── Mic capture ──────────────────────────────────────────────────────────

	const startCapture = useCallback(
		(stream: MediaStream, streamSid: string) => {
			const captureCtx = new AudioContext();
			captureCtxRef.current = captureCtx;

			const source = captureCtx.createMediaStreamSource(stream);
			const nativeSampleRate = captureCtx.sampleRate;
			const ratio = nativeSampleRate / TARGET_SAMPLE_RATE;

			// ScriptProcessorNode (deprecated but universally supported)
			const bufferSize = 4096;
			// biome-ignore lint/suspicious/noExplicitAny: deprecated API
			const processor = (captureCtx as any).createScriptProcessor(
				bufferSize,
				1,
				1,
			) as ScriptProcessorNode;
			scriptProcessorRef.current = processor;

			// Accumulate resampled samples, emit 160-sample (20 ms) frames
			processor.onaudioprocess = (e: AudioProcessingEvent) => {
				const inputData = e.inputBuffer.getChannelData(0);

				// Downsample: simple decimation (no anti-aliasing filter)
				const outputLen = Math.floor(inputData.length / ratio);
				const resampled = new Float32Array(outputLen);
				for (let i = 0; i < outputLen; i++) {
					resampled[i] = inputData[Math.floor(i * ratio)];
				}

				// Append to accumulator
				const prev = pcmBufferRef.current;
				const combined = new Float32Array(prev.length + resampled.length);
				combined.set(prev);
				combined.set(resampled, prev.length);
				pcmBufferRef.current = combined;

				// Emit complete 160-sample frames
				while (pcmBufferRef.current.length >= FRAME_SAMPLES) {
					const frame = pcmBufferRef.current.slice(0, FRAME_SAMPLES);
					pcmBufferRef.current = pcmBufferRef.current.slice(FRAME_SAMPLES);
					const encoded = encodeUlawToBase64(frame);
					sendMediaFrame(encoded, streamSid);
				}
			};

			// Connect graph (output to destination is required even if silent)
			source.connect(processor);
			processor.connect(captureCtx.destination);
		},
		[sendMediaFrame],
	);

	// ─── Main connect / disconnect ─────────────────────────────────────────────

	const { trigger: saveSettings } = usePostApiTestCallSettings();

	const startCall = useCallback(
		async (phoneNumber: string, settings?: CallSettings) => {
			if (status !== "idle" && status !== "ended" && status !== "error") return;

			const trimmedPhone = phoneNumber.trim();
			if (!trimmedPhone) return;

			const realtimeUrl = process.env.NEXT_PUBLIC_REALTIME_URL?.trim();
			if (!realtimeUrl) {
				console.error("NEXT_PUBLIC_REALTIME_URL is not set");
				setError("NEXT_PUBLIC_REALTIME_URL is not set");
				setStatus("error");
				return;
			}

			setError(null);
			resetTranscript();
			resetRecording();

			// 1. Request microphone
			setStatus("requesting-mic");
			let stream: MediaStream;
			try {
				stream = await navigator.mediaDevices.getUserMedia({
					audio: {
						echoCancellation: true,
						noiseSuppression: true,
						autoGainControl: true,
					},
				});
			} catch (err) {
				const msg =
					err instanceof Error ? err.message : "Microphone access denied";
				setError(msg);
				setStatus("error");
				return;
			}
			micStreamRef.current = stream;

			// Generate IDs
			const sid = makeSid("CA_SIM_");
			const streamSid = makeSid("MZ_SIM_");
			setCallSid(sid);
			callSidRef.current = sid;

			// Per-call model choices go to Redis first; the voice server reads
			// them (by `?cs=`) when the stream connects.
			if (settings) {
				try {
					await saveSettings({ callSid: sid, settings });
				} catch (err) {
					for (const track of stream.getTracks()) track.stop();
					micStreamRef.current = null;
					setError(
						err instanceof Error
							? `Could not save model settings: ${err.message}`
							: "Could not save model settings",
					);
					setStatus("error");
					return;
				}
			}

			// 2. Open WebSocket to /media-stream
			setStatus("connecting");
			const wsUrl = settings
				? `${realtimeUrl}/media-stream?cs=${encodeURIComponent(sid)}`
				: `${realtimeUrl}/media-stream`;

			const ws = new WebSocket(wsUrl);
			wsRef.current = ws;

			ws.onopen = () => {
				// 3a. Send connected
				ws.send(
					JSON.stringify({
						event: "connected",
						protocol: "Call",
						version: "1.0.0",
					}),
				);

				// 3b. Send start
				ws.send(
					JSON.stringify({
						event: "start",
						sequenceNumber: "1",
						streamSid,
						start: {
							streamSid,
							accountSid: "AC_SIM_BROWSER",
							callSid: sid,
							tracks: ["inbound"],
							mediaFormat: {
								encoding: "audio/x-mulaw",
								sampleRate: TARGET_SAMPLE_RATE,
								channels: 1,
							},
							customParameters: {
								callerPhone: trimmedPhone,
								simulated: "true",
							},
						},
					}),
				);

				setStatus("in-call");

				// 4. Start mic capture and stream media frames
				startCapture(stream, streamSid);

				// Record the caller (mic) and the AI voice (playback tap) together.
				ensurePlayContext();
				startRecording();
				addRecordingStream(stream);
				if (playDestRef.current) addRecordingStream(playDestRef.current.stream);

				// Also subscribe to the dashboard for transcripts
				connectDashboard(sid);
			};

			ws.onmessage = (evt) => {
				try {
					const msg = JSON.parse(evt.data as string) as {
						event: string;
						streamSid?: string;
						media?: { payload: string };
						mark?: { name: string };
					};

					switch (msg.event) {
						case "media":
							// Play AI audio
							if (msg.media?.payload) {
								playAiChunk(msg.media.payload);
							}
							break;

						case "clear": {
							// Barge-in: flush scheduled AI audio. Twilio answers a clear by
							// returning every pending mark immediately.
							flushPlaybackQueue();
							const pending = [...pendingMarksRef.current];
							pendingMarksRef.current.clear();
							for (const [timer, echo] of pending) {
								clearTimeout(timer);
								echo();
							}
							break;
						}

						case "mark": {
							// Echo the mark only after the audio before it has played.
							const { streamSid, mark } = msg;
							if (!streamSid || !mark) break;
							const echo = () => {
								if (ws.readyState !== WebSocket.OPEN) return;
								ws.send(
									JSON.stringify({
										event: "mark",
										sequenceNumber: "0",
										streamSid,
										mark: { name: mark.name },
									}),
								);
							};
							const ctx = playCtxRef.current;
							const delayMs = ctx
								? Math.max(0, nextPlayTimeRef.current - ctx.currentTime) * 1000
								: 0;
							if (delayMs <= 0) {
								echo();
								break;
							}
							const timer = setTimeout(() => {
								pendingMarksRef.current.delete(timer);
								echo();
							}, delayMs);
							pendingMarksRef.current.set(timer, echo);
							break;
						}

						default:
							break;
					}
				} catch {
					// ignore parse errors
				}
			};

			ws.onclose = () => {
				stopRecording(callSidRef.current);
				stopCapture();
				stopPlayback();
				setStatus("ended");
				wsRef.current = null;
				disconnectDashboard();
			};

			ws.onerror = () => {
				setError("WebSocket connection failed. Is the voice server running?");
				setStatus("error");
				resetRecording();
				stopCapture();
				stopPlayback();
				for (const t of stream.getTracks()) t.stop();
			};
		},
		[
			status,
			saveSettings,
			resetTranscript,
			resetRecording,
			startRecording,
			addRecordingStream,
			stopRecording,
			ensurePlayContext,
			startCapture,
			connectDashboard,
			disconnectDashboard,
			playAiChunk,
			flushPlaybackQueue,
			stopCapture,
			stopPlayback,
			closeWs,
		],
	);

	const hangUp = useCallback(() => {
		const ws = wsRef.current;
		const sid = callSidRef.current ?? wsRef.current?.url;

		if (ws?.readyState === WebSocket.OPEN) {
			// Send stop event then close
			ws.send(
				JSON.stringify({
					event: "stop",
					sequenceNumber: "99",
					streamSid: sid ?? "",
					stop: {
						accountSid: "AC_SIM_BROWSER",
						callSid: callSidRef.current ?? "",
					},
				}),
			);
			ws.close();
		}

		stopRecording(callSidRef.current);
		stopCapture();
		stopPlayback();
		disconnectDashboard();

		setStatus("ended");
	}, [stopRecording, stopCapture, stopPlayback, disconnectDashboard]);

	// ─── Cleanup on unmount ────────────────────────────────────────────────────

	useEffect(() => {
		return () => {
			stopCapture();
			stopPlayback();
			closeWs(wsRef.current);
		};
	}, [stopCapture, stopPlayback, closeWs]);

	return {
		status,
		callSid,
		error,
		transcript,
		recordingUrl,
		recordingStatus,
		retryRecordingSave,
		startCall,
		hangUp,
	};
}
