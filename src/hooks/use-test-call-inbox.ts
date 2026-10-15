"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type IncomingTestCall = {
	reason: "refused" | "timeout";
};

/**
 * Listens on the voice server for callbacks addressed to `phone` (the ones that
 * would otherwise go out through Twilio) so the test-call page can ring.
 * Pass `null` to stop listening, e.g. while a call is already running.
 */
export function useTestCallInbox(phone: string | null) {
	const [incoming, setIncoming] = useState<IncomingTestCall | null>(null);
	const wsRef = useRef<WebSocket | null>(null);

	useEffect(() => {
		const realtimeUrl = process.env.NEXT_PUBLIC_REALTIME_URL?.trim();
		if (!phone || !realtimeUrl) return;

		let ws: WebSocket | null = null;
		let retry: ReturnType<typeof setTimeout> | undefined;
		let stopped = false;

		const connect = () => {
			ws = new WebSocket(
				`${realtimeUrl}/test-call-inbox?phone=${encodeURIComponent(phone)}`,
			);
			wsRef.current = ws;
			ws.onmessage = (event) => {
				try {
					const msg = JSON.parse(String(event.data)) as {
						type?: string;
						reason?: string;
					};
					if (msg.type === "call_ended") {
						setIncoming(null);
					} else if (msg.type === "incoming_call") {
						setIncoming({
							reason: msg.reason === "timeout" ? "timeout" : "refused",
						});
					}
				} catch {
					// ignore malformed frames
				}
			};
			ws.onclose = () => {
				if (!stopped) retry = setTimeout(connect, 3000);
			};
		};
		connect();

		return () => {
			stopped = true;
			clearTimeout(retry);
			ws?.close();
			wsRef.current = null;
			setIncoming(null);
		};
	}, [phone]);

	/** Tell the voice server how the ring ended; a decline triggers the WhatsApp fallback. */
	const respond = useCallback((outcome: "answered" | "declined") => {
		try {
			wsRef.current?.send(JSON.stringify({ type: outcome }));
		} catch {
			// socket closed: the server treats that as unanswered
		}
		setIncoming(null);
	}, []);

	return { incoming, respond };
}
