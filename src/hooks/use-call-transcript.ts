"use client";

/**
 * useCallTranscript
 *
 * Subscribes to the voice server's `/dashboard` WebSocket and builds the live
 * transcript for one call (filtered by callSid). Shared by the test-call hooks:
 * both the Twilio-stream simulation and the LiveKit agent publish transcripts
 * there.
 */

import { useCallback, useEffect, useRef, useState } from "react";

export type TranscriptLine = {
	id: string;
	role: "patient" | "ai";
	text: string;
	isFinal: boolean;
};

export function useCallTranscript() {
	const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
	const dashWsRef = useRef<WebSocket | null>(null);

	const disconnect = useCallback(() => {
		const ws = dashWsRef.current;
		dashWsRef.current = null;
		try {
			if (ws?.readyState === WebSocket.OPEN) ws.close();
		} catch {}
	}, []);

	const reset = useCallback(() => setTranscript([]), []);

	const connect = useCallback(
		(sid: string) => {
			const realtimeUrl = process.env.NEXT_PUBLIC_REALTIME_URL?.trim();
			if (!realtimeUrl) {
				console.error("NEXT_PUBLIC_REALTIME_URL is not set");
				return;
			}

			disconnect();
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
				if (dashWsRef.current === dashWs) dashWsRef.current = null;
			};
		},
		[disconnect],
	);

	useEffect(() => disconnect, [disconnect]);

	return { transcript, connect, disconnect, reset };
}
