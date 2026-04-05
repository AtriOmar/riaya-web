"use client";

import { useEffect, useRef } from "react";

type TranscriptEntry = {
	role: "patient" | "ai" | "system";
	text: string;
	timestamp: number;
};

function TranscriptEntryItem({ entry }: { entry: TranscriptEntry }) {
	const { role, text, timestamp } = entry;
	const time = new Date(timestamp).toLocaleTimeString([], {
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
	});

	if (role === "system") {
		return (
			<div className="flex items-center gap-2 py-1">
				<span className="text-muted-foreground text-xs">{time}</span>
				<span className="text-muted-foreground text-xs italic">{text}</span>
			</div>
		);
	}

	const isAI = role === "ai";

	return (
		<div className={`flex gap-2 ${isAI ? "" : "flex-row-reverse"}`}>
			<div
				className={`max-w-[80%] rounded-xl px-3.5 py-2 text-sm ${
					isAI
						? "bg-primary/10 text-primary-foreground rounded-tl-sm"
						: "bg-muted text-foreground rounded-tr-sm"
				}`}
			>
				<div className="flex items-center gap-2 mb-0.5">
					<span
						className={`text-[10px] font-semibold uppercase tracking-wide ${
							isAI ? "text-primary" : "text-muted-foreground"
						}`}
					>
						{isAI ? "AI Assistant" : "Patient"}
					</span>
					<span className="text-[10px] text-muted-foreground">{time}</span>
				</div>
				<p className="leading-relaxed whitespace-pre-wrap">{text}</p>
			</div>
		</div>
	);
}

export default function CallTranscript({
	transcript,
	isActive,
}: {
	transcript: TranscriptEntry[];
	isActive: boolean;
}) {
	const bottomRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		bottomRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [transcript.length]);

	if (transcript.length === 0) {
		return (
			<div className="px-5 py-8 text-muted-foreground text-sm text-center">
				{isActive
					? "Waiting for conversation to begin..."
					: "No transcript available"}
			</div>
		);
	}

	return (
		<div className="space-y-2 max-h-[400px] overflow-y-auto px-5 py-3">
			{transcript.map((entry) => (
				<TranscriptEntryItem
					key={`${entry.timestamp}-${entry.role}`}
					entry={entry}
				/>
			))}
			<div ref={bottomRef} />
		</div>
	);
}
