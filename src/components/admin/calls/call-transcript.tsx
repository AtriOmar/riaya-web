"use client";

import {
	AlertCircle,
	CheckCircle2,
	ChevronDown,
	ChevronRight,
	Loader2,
	Wrench,
} from "lucide-react";
import { useState } from "react";
import type { TimelineEntry } from "@/hooks/use-realtime-socket";
import { cn } from "@/lib/utils";

function formatTime(timestamp: number): string {
	return new Date(timestamp).toLocaleTimeString([], {
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
	});
}

function TranscriptBubble({
	role,
	text,
	timestamp,
}: {
	role: "patient" | "ai";
	text: string;
	timestamp: number;
}) {
	const isAI = role === "ai";
	return (
		<div className={`flex gap-2 ${isAI ? "" : "flex-row-reverse"}`}>
			<div
				className={`max-w-[80%] rounded-xl px-3.5 py-2 text-sm ${
					isAI
						? "bg-primary/10 text-foreground rounded-tl-sm"
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
					<span className="text-[10px] text-muted-foreground">
						{formatTime(timestamp)}
					</span>
				</div>
				<p className="leading-relaxed whitespace-pre-wrap">{text}</p>
			</div>
		</div>
	);
}

function FunctionCallBlock({
	name,
	args,
	result,
	status,
	timestamp,
}: {
	name: string;
	args: unknown;
	result?: unknown;
	status: "calling" | "success" | "error";
	timestamp: number;
}) {
	const [open, setOpen] = useState(false);

	const Icon =
		status === "calling"
			? Loader2
			: status === "success"
				? CheckCircle2
				: AlertCircle;

	const color =
		status === "calling"
			? "text-muted-foreground"
			: status === "success"
				? "text-green-600"
				: "text-red-600";

	return (
		<div className="rounded-lg border bg-background/50 overflow-hidden">
			<button
				type="button"
				onClick={() => setOpen((o) => !o)}
				className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-muted/30 transition-colors"
			>
				{open ? (
					<ChevronDown className="size-3.5 text-muted-foreground shrink-0" />
				) : (
					<ChevronRight className="size-3.5 text-muted-foreground shrink-0" />
				)}
				<Wrench className="size-3.5 text-muted-foreground shrink-0" />
				<span className="font-mono text-xs font-medium">{name}</span>
				<Icon
					className={`size-3.5 shrink-0 ${color} ${status === "calling" ? "animate-spin" : ""}`}
				/>
				<span className="ml-auto text-[10px] text-muted-foreground">
					{formatTime(timestamp)}
				</span>
			</button>
			{open && (
				<div className="px-3 pb-3 pt-1 space-y-2 text-xs">
					<div>
						<div className="text-[10px] font-semibold uppercase text-muted-foreground mb-1">
							Arguments
						</div>
						<pre className="p-2 rounded bg-muted/50 overflow-x-auto font-mono text-[11px] leading-snug whitespace-pre-wrap break-words">
							{typeof args === "string" ? args : JSON.stringify(args, null, 2)}
						</pre>
					</div>
					{result !== undefined && result !== null && (
						<div>
							<div className="text-[10px] font-semibold uppercase text-muted-foreground mb-1">
								Result
							</div>
							<pre className="p-2 rounded bg-muted/50 overflow-x-auto font-mono text-[11px] leading-snug whitespace-pre-wrap break-words">
								{typeof result === "string"
									? result
									: JSON.stringify(result, null, 2)}
							</pre>
						</div>
					)}
				</div>
			)}
		</div>
	);
}

function SystemLine({ text, timestamp }: { text: string; timestamp: number }) {
	return (
		<div className="flex items-center justify-center gap-2 py-1">
			<span className="text-muted-foreground text-[10px]">
				{formatTime(timestamp)}
			</span>
			<span className="text-muted-foreground text-xs italic">{text}</span>
		</div>
	);
}

function ErrorLine({ text, timestamp }: { text: string; timestamp: number }) {
	return (
		<div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-destructive/10 text-destructive">
			<AlertCircle className="size-3.5 shrink-0" />
			<span className="text-xs font-medium">{text}</span>
			<span className="ml-auto text-[10px] opacity-70">
				{formatTime(timestamp)}
			</span>
		</div>
	);
}

export default function CallTranscript({
	timeline,
	isActive,
	scrollAreaClassName,
	variant = "default",
}: {
	timeline: TimelineEntry[];
	isActive: boolean;
	/** Merged with default scroll container classes (spacing, overflow). */
	scrollAreaClassName?: string;
	/** `drawer`: edge-to-edge transcript area for slide-over panels. */
	variant?: "default" | "drawer";
}) {
	const isDrawer = variant === "drawer";

	if (timeline.length === 0) {
		return (
			<div
				className={cn(
					"py-8 text-muted-foreground text-sm text-center",
					isDrawer ? "px-4" : "px-5",
				)}
			>
				{isActive
					? "Waiting for conversation to begin..."
					: "No transcript available"}
			</div>
		);
	}

	return (
		<div
			className={cn(
				"space-y-2 overflow-y-auto py-3",
				isDrawer ? "min-h-0 flex-1 px-3" : "px-5",
				scrollAreaClassName ?? (!isDrawer ? "max-h-[500px]" : undefined),
			)}
		>
			{timeline.map((entry) => {
				switch (entry.kind) {
					case "transcript":
						return (
							<TranscriptBubble
								key={entry.id}
								role={entry.role}
								text={entry.text}
								timestamp={entry.timestamp}
							/>
						);
					case "function_call":
						return (
							<FunctionCallBlock
								key={entry.id}
								name={entry.name}
								args={entry.args}
								result={entry.result}
								status={entry.status}
								timestamp={entry.timestamp}
							/>
						);
					case "system":
						return (
							<SystemLine
								key={entry.id}
								text={entry.text}
								timestamp={entry.timestamp}
							/>
						);
					case "error":
						return (
							<ErrorLine
								key={entry.id}
								text={entry.text}
								timestamp={entry.timestamp}
							/>
						);
					default:
						return null;
				}
			})}
		</div>
	);
}
