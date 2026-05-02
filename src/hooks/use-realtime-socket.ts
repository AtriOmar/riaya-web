"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import useSWR from "swr";
import { getCalls } from "@/services/calls";
import type {
	CallEvent,
	CallEventType,
	CallWithEvents,
	FunctionCallStatus,
} from "@/services/types";

const RECONNECT_DELAYS = [1000, 2000, 4000, 8000, 16000];

// ─── Unified timeline entry ──────────────────────────────────────────────────
export type TimelineEntry =
	| {
			id: string;
			kind: "transcript";
			role: "patient" | "ai";
			text: string;
			timestamp: number;
	  }
	| {
			id: string;
			kind: "function_call";
			name: string;
			args: unknown;
			result?: unknown;
			status: FunctionCallStatus;
			timestamp: number;
	  }
	| {
			id: string;
			kind: "system";
			text: string;
			timestamp: number;
	  }
	| {
			id: string;
			kind: "error";
			text: string;
			timestamp: number;
	  };

export type CallData = {
	id?: number;
	callSid: string;
	from: string | null;
	callerName: string | null;
	startTime: string;
	endTime?: string;
	duration?: number | null;
	status: "active" | "ended";
	recordingUrl?: string | null;
	timeline: TimelineEntry[];
};

type WsMessage =
	| { type: "call_start"; callSid: string; timestamp: string }
	| { type: "call_end"; callSid: string; timestamp: string }
	| {
			type: "patient_transcript";
			callSid: string;
			text: string;
			isFinal: boolean;
	  }
	| {
			type: "ai_transcript";
			callSid: string;
			text: string;
			isFinal: boolean;
	  }
	| { type: "patient_audio" | "ai_audio"; callSid: string; payload: string }
	| {
			type: "function_call";
			callSid: string;
			name: string;
			args: unknown;
			status: FunctionCallStatus;
			result?: unknown;
	  }
	| { type: "appointment_booked"; callSid: string }
	| { type: "error"; callSid: string; message: string };

// ─── Helpers ─────────────────────────────────────────────────────────────────

function dbEventToTimeline(event: CallEvent): TimelineEntry | null {
	const timestamp = event.timestamp
		? new Date(event.timestamp).getTime()
		: Date.now();
	const id = `db-${event.id}`;
	const type = event.type as CallEventType;

	switch (type) {
		case "patient_transcript":
			return {
				id,
				kind: "transcript",
				role: "patient",
				text: event.content ?? "",
				timestamp,
			};
		case "ai_transcript":
			return {
				id,
				kind: "transcript",
				role: "ai",
				text: event.content ?? "",
				timestamp,
			};
		case "function_call":
			return {
				id,
				kind: "function_call",
				name: event.functionName ?? "unknown",
				args: event.functionArgs,
				result: event.functionResult,
				status: (event.functionStatus as FunctionCallStatus) ?? "success",
				timestamp,
			};
		case "appointment_booked":
		case "system":
			return {
				id,
				kind: "system",
				text: event.content ?? "",
				timestamp,
			};
		case "error":
			return {
				id,
				kind: "error",
				text: event.content ?? "",
				timestamp,
			};
		default:
			return null;
	}
}

function dbCallToData(row: CallWithEvents): CallData {
	const timeline = row.events
		.map(dbEventToTimeline)
		.filter((e): e is TimelineEntry => e !== null)
		.sort((a, b) => a.timestamp - b.timestamp);

	return {
		id: row.id,
		callSid: row.callSid,
		from: row.from ?? null,
		callerName: row.callerName ?? null,
		startTime: row.startedAt
			? new Date(row.startedAt).toISOString()
			: new Date().toISOString(),
		endTime: row.endedAt ? new Date(row.endedAt).toISOString() : undefined,
		duration: row.duration ?? null,
		status: row.status === "in-progress" ? "active" : "ended",
		recordingUrl: row.recordingUrl ?? null,
		timeline,
	};
}

/**
 * Deduplicate timeline entries against a newly arriving WS entry. For function
 * calls we replace any earlier `calling` entry for the same function name so
 * the timeline shows one line that transitions calling → success/error.
 */
function appendTimeline(
	existing: TimelineEntry[],
	next: TimelineEntry,
): TimelineEntry[] {
	if (next.kind === "function_call" && next.status !== "calling") {
		const idx = existing.findIndex(
			(e) =>
				e.kind === "function_call" &&
				e.name === next.name &&
				e.status === "calling",
		);
		if (idx >= 0) {
			const copy = existing.slice();
			copy[idx] = next;
			return copy;
		}
	}
	return [...existing, next];
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export default function useRealtimeSocket() {
	const [calls, setCalls] = useState<Map<string, CallData>>(new Map());
	const [isConnected, setIsConnected] = useState(false);
	const [listeningCalls, setListeningCalls] = useState<Set<string>>(new Set());

	const wsRef = useRef<WebSocket | null>(null);
	const reconnectAttempt = useRef(0);
	const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const audioCallbackRef = useRef<
		((callSid: string, role: string, payload: string) => void) | null
	>(null);

	// Initial fetch from the DB so the dashboard is authoritative on load,
	// then WS events merge on top for live updates.
	const {
		data: dbCalls,
		isLoading: isLoadingCalls,
		mutate: mutateCalls,
	} = useSWR<CallWithEvents[]>("/api/calls", getCalls, {
		revalidateOnFocus: false,
	});

	useEffect(() => {
		if (!dbCalls) return;
		setCalls((prev) => {
			const next = new Map(prev);
			for (const row of dbCalls) {
				const fromDb = dbCallToData(row);
				const existing = next.get(row.callSid);
				if (!existing) {
					next.set(row.callSid, fromDb);
					continue;
				}
				// Merge: keep live timeline entries we already have that aren't in DB yet.
				const dbIds = new Set(fromDb.timeline.map((t) => t.id));
				const extraLive = existing.timeline.filter((t) => !dbIds.has(t.id));
				next.set(row.callSid, {
					...fromDb,
					// Live status wins if we already marked it active
					status:
						existing.status === "active" && fromDb.status === "ended"
							? "ended"
							: fromDb.status,
					timeline: [...fromDb.timeline, ...extraLive].sort(
						(a, b) => a.timestamp - b.timestamp,
					),
				});
			}
			return next;
		});
	}, [dbCalls]);

	const toggleListening = useCallback((callSid: string) => {
		setListeningCalls((prev) => {
			const next = new Set(prev);
			if (next.has(callSid)) next.delete(callSid);
			else next.add(callSid);
			return next;
		});
	}, []);

	const handleMessage = useCallback(
		(msg: WsMessage) => {
			switch (msg.type) {
				case "call_start":
					setCalls((prev) => {
						const next = new Map(prev);
						const existing = next.get(msg.callSid);
						if (existing) {
							next.set(msg.callSid, {
								...existing,
								status: "active",
								startTime: msg.timestamp,
							});
						} else {
							next.set(msg.callSid, {
								callSid: msg.callSid,
								from: null,
								callerName: null,
								startTime: msg.timestamp,
								status: "active",
								timeline: [],
							});
						}
						return next;
					});
					// Kick a revalidation so we eventually pick up the DB id + phone.
					setTimeout(() => mutateCalls(), 1500);
					break;

				case "call_end":
					setCalls((prev) => {
						const next = new Map(prev);
						const call = next.get(msg.callSid);
						if (call) {
							next.set(msg.callSid, {
								...call,
								status: "ended",
								endTime: msg.timestamp,
							});
						}
						return next;
					});
					setListeningCalls((prev) => {
						const next = new Set(prev);
						next.delete(msg.callSid);
						return next;
					});
					// Refetch so we pick up the recording URL once it lands.
					setTimeout(() => mutateCalls(), 5000);
					setTimeout(() => mutateCalls(), 30000);
					break;

				case "patient_transcript":
					if (!msg.isFinal) break;
					setCalls((prev) => {
						const next = new Map(prev);
						const call = next.get(msg.callSid);
						if (!call) return prev;
						const entry: TimelineEntry = {
							id: `live-${Date.now()}-${Math.random()}`,
							kind: "transcript",
							role: "patient",
							text: msg.text,
							timestamp: Date.now(),
						};
						next.set(msg.callSid, {
							...call,
							timeline: appendTimeline(call.timeline, entry),
						});
						return next;
					});
					break;

				case "ai_transcript":
					if (!msg.isFinal) break;
					setCalls((prev) => {
						const next = new Map(prev);
						const call = next.get(msg.callSid);
						if (!call) return prev;
						const entry: TimelineEntry = {
							id: `live-${Date.now()}-${Math.random()}`,
							kind: "transcript",
							role: "ai",
							text: msg.text,
							timestamp: Date.now(),
						};
						next.set(msg.callSid, {
							...call,
							timeline: appendTimeline(call.timeline, entry),
						});
						return next;
					});
					break;

				case "patient_audio":
				case "ai_audio": {
					const role = msg.type === "patient_audio" ? "patient" : "ai";
					audioCallbackRef.current?.(msg.callSid, role, msg.payload);
					break;
				}

				case "function_call":
					setCalls((prev) => {
						const next = new Map(prev);
						const call = next.get(msg.callSid);
						if (!call) return prev;
						const entry: TimelineEntry = {
							id: `live-fn-${msg.name}-${Date.now()}`,
							kind: "function_call",
							name: msg.name,
							args: msg.args,
							result: msg.result,
							status: msg.status,
							timestamp: Date.now(),
						};
						next.set(msg.callSid, {
							...call,
							timeline: appendTimeline(call.timeline, entry),
						});
						return next;
					});
					break;

				case "appointment_booked":
					setCalls((prev) => {
						const next = new Map(prev);
						const call = next.get(msg.callSid);
						if (!call) return prev;
						const entry: TimelineEntry = {
							id: `live-${Date.now()}`,
							kind: "system",
							text: "Appointment booked",
							timestamp: Date.now(),
						};
						next.set(msg.callSid, {
							...call,
							timeline: appendTimeline(call.timeline, entry),
						});
						return next;
					});
					break;

				case "error":
					setCalls((prev) => {
						const next = new Map(prev);
						const call = next.get(msg.callSid);
						if (!call) return prev;
						const entry: TimelineEntry = {
							id: `live-${Date.now()}`,
							kind: "error",
							text: msg.message,
							timestamp: Date.now(),
						};
						next.set(msg.callSid, {
							...call,
							timeline: appendTimeline(call.timeline, entry),
						});
						return next;
					});
					break;
			}
		},
		[mutateCalls],
	);

	const connectRef = useRef<() => void>(() => {});

	const scheduleReconnect = useCallback(() => {
		if (reconnectTimer.current) return;
		const delay =
			RECONNECT_DELAYS[
				Math.min(reconnectAttempt.current, RECONNECT_DELAYS.length - 1)
			];
		reconnectAttempt.current++;
		reconnectTimer.current = setTimeout(() => {
			reconnectTimer.current = null;
			connectRef.current();
		}, delay);
	}, []);

	const connect = useCallback(() => {
		const url = process.env.NEXT_PUBLIC_REALTIME_URL;
		if (!url) return;

		try {
			const ws = new WebSocket(`${url}/dashboard`);
			wsRef.current = ws;

			ws.onopen = () => {
				setIsConnected(true);
				reconnectAttempt.current = 0;
			};

			ws.onclose = () => {
				setIsConnected(false);
				wsRef.current = null;
				scheduleReconnect();
			};

			ws.onerror = () => {
				/* onclose will fire */
			};

			ws.onmessage = (event) => {
				try {
					handleMessage(JSON.parse(event.data));
				} catch {
					/* ignore malformed messages */
				}
			};
		} catch {
			scheduleReconnect();
		}
	}, [handleMessage, scheduleReconnect]);

	useEffect(() => {
		connectRef.current = connect;
	}, [connect]);

	useEffect(() => {
		connect();
		return () => {
			if (reconnectTimer.current) {
				clearTimeout(reconnectTimer.current);
				reconnectTimer.current = null;
			}
			if (wsRef.current) {
				wsRef.current.onclose = null;
				wsRef.current.close();
				wsRef.current = null;
			}
		};
	}, [connect]);

	return {
		calls,
		isConnected,
		isLoadingCalls,
		listeningCalls,
		toggleListening,
		audioCallbackRef,
		refreshCalls: mutateCalls,
	};
}
