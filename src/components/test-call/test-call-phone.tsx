"use client";

import { Loader2, Mic, MicOff, Phone, PhoneCall, PhoneOff } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	type SimulatedCallStatus,
	useSimulatedCall,
} from "@/hooks/use-simulated-call";
import { cn } from "@/lib/utils";

// ─── Status helpers ────────────────────────────────────────────────────────────

function statusLabel(s: SimulatedCallStatus): string {
	switch (s) {
		case "idle":
			return "Enter a phone number to start a simulated call";
		case "requesting-mic":
			return "Requesting microphone access…";
		case "connecting":
			return "Connecting to voice server…";
		case "in-call":
			return "In call — speak into your microphone";
		case "ended":
			return "Call ended";
		case "error":
			return "Error";
	}
}

function statusColor(s: SimulatedCallStatus): string {
	switch (s) {
		case "in-call":
			return "text-green-600 dark:text-green-400";
		case "ended":
			return "text-muted-foreground";
		case "error":
			return "text-destructive";
		default:
			return "text-muted-foreground";
	}
}

// ─── Transcript bubble ────────────────────────────────────────────────────────

function Bubble({
	role,
	text,
	isFinal,
}: {
	role: "patient" | "ai";
	text: string;
	isFinal: boolean;
}) {
	const isAI = role === "ai";
	return (
		<div
			className={cn(
				"flex gap-2",
				isAI ? "justify-start" : "justify-end",
				!isFinal && "opacity-60",
			)}
		>
			<div
				className={cn(
					"max-w-[80%] rounded-xl px-3.5 py-2 text-sm leading-relaxed",
					isAI
						? "bg-primary/10 text-foreground rounded-tl-sm"
						: "bg-muted text-foreground rounded-tr-sm",
				)}
			>
				<div className="mb-0.5 flex items-center gap-2">
					<span
						className={cn(
							"text-[10px] font-semibold uppercase tracking-wide",
							isAI ? "text-primary" : "text-muted-foreground",
						)}
					>
						{isAI ? "AI Assistant" : "You"}
					</span>
					{!isFinal && (
						<Loader2 className="size-2.5 animate-spin text-muted-foreground" />
					)}
				</div>
				<p className="whitespace-pre-wrap">{text}</p>
			</div>
		</div>
	);
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function TestCallPhone() {
	const [phone, setPhone] = useState("");
	const { status, callSid, error, transcript, startCall, hangUp } =
		useSimulatedCall();

	const scrollRef = useRef<HTMLDivElement>(null);

	const isActive = status === "in-call";
	const isBusy =
		status === "requesting-mic" ||
		status === "connecting" ||
		status === "in-call";
	const canCall = status === "idle" || status === "ended" || status === "error";

	const handleCall = () => {
		if (!canCall) return;
		void startCall(phone);
	};

	const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === "Enter" && canCall && phone.trim()) {
			handleCall();
		}
	};

	return (
		<div className="flex min-h-svh items-center justify-center bg-background p-4">
			<div className="w-full max-w-md">
				{/* Phone card */}
				<div className="overflow-hidden rounded-2xl border bg-card shadow-lg">
					{/* Header */}
					<div
						className={cn(
							"flex items-center gap-3 px-5 py-4 transition-colors",
							isActive ? "bg-primary/5" : "bg-muted/40",
						)}
					>
						<div className="relative shrink-0">
							<div
								className={cn(
									"flex size-11 items-center justify-center rounded-full",
									isActive ? "bg-primary/10" : "bg-muted",
								)}
							>
								{status === "requesting-mic" || status === "connecting" ? (
									<Loader2 className="size-5 animate-spin text-muted-foreground" />
								) : isActive ? (
									<PhoneCall className="size-5 text-primary" />
								) : status === "ended" ? (
									<PhoneOff className="size-5 text-muted-foreground" />
								) : (
									<Phone className="size-5 text-muted-foreground" />
								)}
							</div>
							{isActive && (
								<span className="-top-0.5 -right-0.5 absolute size-3 rounded-full border-2 border-card bg-green-500 animate-pulse" />
							)}
						</div>

						<div className="min-w-0 flex-1">
							<p className="font-semibold text-sm">
								{isActive ? phone || "Simulated Call" : "Test Call Simulator"}
							</p>
							<p className={cn("text-xs", statusColor(status))}>
								{error ? error : statusLabel(status)}
							</p>
						</div>

						{isActive && (
							<div className="flex items-center gap-1.5 rounded-md bg-green-500/10 px-2 py-1">
								<span className="size-1.5 rounded-full bg-green-500 animate-pulse" />
								<span className="font-mono text-[10px] font-medium text-green-600 dark:text-green-400">
									LIVE
								</span>
							</div>
						)}
					</div>

					{/* Transcript area */}
					<div
						ref={scrollRef}
						className="flex h-72 min-h-0 flex-col gap-3 overflow-y-auto p-4"
						style={{ scrollBehavior: "smooth" }}
					>
						{transcript.length === 0 ? (
							<div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
								{isActive ? (
									<>
										<Mic className="size-8 text-muted-foreground/40" />
										<p className="text-muted-foreground text-sm">
											Waiting for conversation…
										</p>
									</>
								) : (
									<>
										<MicOff className="size-8 text-muted-foreground/30" />
										<p className="text-muted-foreground text-sm">
											Transcript will appear here during the call
										</p>
									</>
								)}
							</div>
						) : (
							transcript.map((line) => (
								<Bubble
									key={line.id}
									role={line.role}
									text={line.text}
									isFinal={line.isFinal}
								/>
							))
						)}
					</div>

					{/* Footer: call SID debug info */}
					{callSid && (
						<div className="border-t bg-muted/30 px-4 py-2">
							<p className="truncate font-mono text-[10px] text-muted-foreground">
								{callSid}
							</p>
						</div>
					)}

					{/* Controls */}
					<div className="border-t p-4">
						<div className="flex gap-2">
							<Input
								type="tel"
								placeholder="+216XXXXXXXX"
								value={phone}
								onChange={(e) => setPhone(e.target.value)}
								onKeyDown={handleKey}
								disabled={isBusy}
								className="flex-1 font-mono"
							/>

							{isBusy || isActive ? (
								<Button
									variant="destructive"
									size="icon"
									onClick={hangUp}
									title="Hang up"
									disabled={
										status === "requesting-mic" || status === "connecting"
									}
								>
									<PhoneOff className="size-4" />
								</Button>
							) : (
								<Button
									size="icon"
									onClick={handleCall}
									disabled={!phone.trim()}
									title="Call"
									className="bg-green-600 hover:bg-green-700"
								>
									<Phone className="size-4" />
								</Button>
							)}
						</div>

						{status === "ended" && (
							<p className="mt-2 text-center text-muted-foreground text-xs">
								Call ended.{" "}
								<button
									type="button"
									className="underline"
									onClick={() => void startCall(phone)}
								>
									Call again
								</button>
							</p>
						)}
					</div>
				</div>

				{/* Info note */}
				<p className="mt-4 text-center text-muted-foreground text-xs">
					This page simulates a Twilio phone call for testing. Bookings made
					here create real appointments. Use a dedicated test number.
				</p>
			</div>
		</div>
	);
}
