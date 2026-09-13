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
import { decodeUlaw, encodeUlawToBase64 } from "@/lib/ulaw";

// ─── Types ────────────────────────────────────────────────────────────────────

export type SimulatedCallStatus =
	| "idle"
	| "requesting-mic"
	| "connecting"
	| "in-call"
	| "ended"
	| "error";

export type TranscriptLine = {
	id: string;
	role: "patient" | "ai";
	text: string;
	isFinal: boolean;
};

export type SimulatedCallState = {
	status: SimulatedCallStatus;
	callSid: string | null;
	error: string | null;
	transcript: TranscriptLine[];
	startCall: (phoneNumber: string) => Promise<void>;
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
	const [transcript, setTranscript] = useState<TranscriptLine[]>([]);

	// WebSocket to /media-stream
	const wsRef = useRef<WebSocket | null>(null);
	// Dashboard WebSocket to /dashboard (for transcripts)
	const dashWsRef = useRef<WebSocket | null>(null);
	// Current callSid in a ref so closures can read it without stale state
	const callSidRef = useRef<string | null>(null);

	// Audio capture
	const captureCtxRef = useRef<AudioContext | null>(null);
	const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
	const micStreamRef = useRef<MediaStream | null>(null);

	// Audio playback (AI voice)
	const playCtxRef = useRef<AudioContext | null>(null);
	const nextPlayTimeRef = useRef(0);

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
		try {
			playCtxRef.current?.close();
		} catch {}
		playCtxRef.current = null;
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
		// Close and recreate the AudioContext to abort all scheduled audio
		try {
			playCtxRef.current?.close();
		} catch {}
		playCtxRef.current = null;
		nextPlayTimeRef.current = 0;
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

	// ─── Dashboard WS (transcripts) ───────────────────────────────────────────

	const connectDashboard = useCallback((sid: string) => {
		const realtimeUrl = process.env.NEXT_PUBLIC_REALTIME_URL;
		if (!realtimeUrl) return;

		const dashWs = new WebSocket(`${realtimeUrl}/dashboard`);
		dashWsRef.current = dashWs;

		dashWs.onmessage = (evt) => {
			try {
				const msg = JSON.parse(evt.data as string) as Record<string, unknown>;
				if (msg.callSid !== sid) return;

				if (
					msg.type === "patient_transcript" &&
					msg.isFinal &&
					typeof msg.text === "string"
				) {
					setTranscript((prev) => [
						...prev.filter((l) => !(l.role === "patient" && !l.isFinal)),
						{
							id: `p-${Date.now()}`,
							role: "patient",
							text: msg.text as string,
							isFinal: true,
						},
					]);
				}

				if (msg.type === "ai_transcript" && typeof msg.text === "string") {
					const isFinal = Boolean(msg.isFinal);
					setTranscript((prev) => {
						// Update or append AI line
						const existingIdx = prev.findLastIndex(
							(l) => l.role === "ai" && !l.isFinal,
						);
						const entry: TranscriptLine = {
							id: existingIdx >= 0 ? prev[existingIdx].id : `a-${Date.now()}`,
							role: "ai",
							text: msg.text as string,
							isFinal,
						};
						if (existingIdx >= 0) {
							const next = [...prev];
							next[existingIdx] = entry;
							return next;
						}
						return [...prev, entry];
					});
				}
			} catch {
				// ignore
			}
		};

		dashWs.onerror = () => {};
		dashWs.onclose = () => {
			dashWsRef.current = null;
		};
	}, []);

	// ─── Main connect / disconnect ─────────────────────────────────────────────

	const startCall = useCallback(
		async (phoneNumber: string) => {
			if (status !== "idle" && status !== "ended" && status !== "error") return;

			const trimmedPhone = phoneNumber.trim();
			if (!trimmedPhone) return;

			setError(null);
			setTranscript([]);

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

			// 2. Open WebSocket to /media-stream
			setStatus("connecting");
			const realtimeUrl =
				process.env.NEXT_PUBLIC_REALTIME_URL ?? "ws://localhost:8080";
			const wsUrl = `${realtimeUrl}/media-stream`;

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

						case "clear":
							// Barge-in: flush scheduled AI audio
							flushPlaybackQueue();
							break;

						case "mark":
							// Echo mark back so TwilioSession's mark queue stays consistent
							if (
								ws.readyState === WebSocket.OPEN &&
								msg.streamSid &&
								msg.mark
							) {
								ws.send(
									JSON.stringify({
										event: "mark",
										sequenceNumber: "0",
										streamSid: msg.streamSid,
										mark: { name: msg.mark.name },
									}),
								);
							}
							break;

						default:
							break;
					}
				} catch {
					// ignore parse errors
				}
			};

			ws.onclose = () => {
				stopCapture();
				stopPlayback();
				setStatus("ended");
				wsRef.current = null;
				closeWs(dashWsRef.current);
			};

			ws.onerror = () => {
				setError("WebSocket connection failed. Is the voice server running?");
				setStatus("error");
				stopCapture();
				stopPlayback();
				for (const t of stream.getTracks()) t.stop();
			};
		},
		[
			status,
			startCapture,
			connectDashboard,
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

		stopCapture();
		stopPlayback();
		closeWs(dashWsRef.current);

		setStatus("ended");
	}, [stopCapture, stopPlayback, closeWs]);

	// ─── Cleanup on unmount ────────────────────────────────────────────────────

	useEffect(() => {
		return () => {
			stopCapture();
			stopPlayback();
			closeWs(wsRef.current);
			closeWs(dashWsRef.current);
		};
	}, [stopCapture, stopPlayback, closeWs]);

	return { status, callSid, error, transcript, startCall, hangUp };
}
