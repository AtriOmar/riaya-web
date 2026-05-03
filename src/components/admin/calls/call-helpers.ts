"use client";

import { useEffect, useState } from "react";
import type { TimelineEntry } from "@/hooks/use-realtime-socket";

export function formatDurationSeconds(seconds: number): string {
	const minutes = Math.floor(seconds / 60);
	const secs = seconds % 60;
	return `${minutes}:${String(secs).padStart(2, "0")}`;
}

export function useCallDuration(
	startTime?: string,
	endTime?: string,
	fixed?: number | null,
) {
	const [elapsed, setElapsed] = useState(0);

	useEffect(() => {
		if (fixed != null) {
			setElapsed(fixed);
			return;
		}
		if (!startTime) return;
		if (endTime) {
			setElapsed(
				Math.max(
					0,
					Math.floor(
						(new Date(endTime).getTime() - new Date(startTime).getTime()) /
							1000,
					),
				),
			);
			return;
		}
		const start = new Date(startTime).getTime();
		const interval = setInterval(() => {
			setElapsed(Math.max(0, Math.floor((Date.now() - start) / 1000)));
		}, 1000);
		return () => clearInterval(interval);
	}, [startTime, endTime, fixed]);

	return formatDurationSeconds(elapsed);
}

export function getTimelinePreview(timeline: TimelineEntry[]): string {
	const lastEntry = timeline[timeline.length - 1];
	if (!lastEntry) return "Waiting for conversation...";
	if (lastEntry.kind === "transcript")
		return `${lastEntry.role === "ai" ? "AI" : "Patient"}: ${lastEntry.text}`;
	if (lastEntry.kind === "function_call")
		return `Tool ${lastEntry.name} (${lastEntry.status})`;
	if (lastEntry.kind === "system") return lastEntry.text;
	if (lastEntry.kind === "error") return `Error: ${lastEntry.text}`;
	return "";
}
