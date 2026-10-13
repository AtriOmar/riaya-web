"use client";

import { Loader2, Mic, MicOff, Phone, PhoneCall, PhoneOff } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import ModelSettingsPanel from "@/components/test-call/model-settings-panel";
import { ThemeToggle } from "@/components/theme-toggle";
import { AudioWaveformPlayer } from "@/components/ui/audio-waveform-player";
import { Button } from "@/components/ui/button";
import { PhoneNumberInput } from "@/components/ui/phone-input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLivekitCall } from "@/hooks/use-livekit-call";
import {
	type SimulatedCallStatus,
	useSimulatedCall,
} from "@/hooks/use-simulated-call";
import type { CallSettings } from "@/lib/call-settings-schema";
import {
	formatPhoneDisplay,
	isValidPhoneNumber,
	normalizePhoneForStorage,
	TEST_CALL_PHONE_COUNTRY_OPTIONS,
} from "@/lib/phone";
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
				<p dir="auto" className="whitespace-pre-wrap [unicode-bidi:plaintext]">
					{text}
				</p>
			</div>
		</div>
	);
}

const TEST_CALL_PHONE_STORAGE_KEY = "riaya:test-call-phone";
const TEST_CALL_ENGINE_STORAGE_KEY = "riaya:test-call-engine";

/** `stream`: fake Twilio media stream → voice server (Gemini Live etc.). `livekit`: LiveKit agent over WebRTC. */
type CallEngine = "stream" | "livekit";

function readPersistedEngine(): CallEngine {
	try {
		return localStorage.getItem(TEST_CALL_ENGINE_STORAGE_KEY) === "livekit"
			? "livekit"
			: "stream";
	} catch {
		return "stream";
	}
}

function persistEngine(engine: CallEngine) {
	try {
		localStorage.setItem(TEST_CALL_ENGINE_STORAGE_KEY, engine);
	} catch {
		// quota / private mode
	}
}

function readPersistedTestCallPhone(): string {
	if (typeof window === "undefined") return "";
	try {
		const raw = localStorage.getItem(TEST_CALL_PHONE_STORAGE_KEY);
		if (!raw?.trim()) return "";
		const normalized = normalizePhoneForStorage(raw);
		if (!normalized || !isValidPhoneNumber(normalized)) return "";
		return normalized;
	} catch {
		return "";
	}
}

function persistTestCallPhone(phone: string) {
	try {
		localStorage.setItem(TEST_CALL_PHONE_STORAGE_KEY, phone);
	} catch {
		// quota / private mode
	}
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function TestCallPhone() {
	const [phone, setPhone] = useState("");
	const [engine, setEngine] = useState<CallEngine>("stream");
	const [settings, setSettings] = useState<CallSettings | undefined>();
	// Both hooks stay mounted; the selected engine drives the UI.
	const streamCall = useSimulatedCall();
	const livekitCall = useLivekitCall();
	const {
		status,
		callSid,
		error,
		transcript,
		recordingUrl,
		recordingStatus,
		retryRecordingSave,
		startCall,
		hangUp,
	} = engine === "livekit" ? livekitCall : streamCall;

	const scrollRef = useRef<HTMLDivElement>(null);
	// Only auto-scroll new lines while the user is already at the bottom,
	// so reading older lines isn't interrupted.
	const stickToBottomRef = useRef(true);

	useLayoutEffect(() => {
		const el = scrollRef.current;
		if (el && stickToBottomRef.current) el.scrollTop = el.scrollHeight;
	}, [transcript]);

	const handleTranscriptScroll = (e: React.UIEvent<HTMLDivElement>) => {
		const el = e.currentTarget;
		stickToBottomRef.current =
			el.scrollHeight - el.scrollTop - el.clientHeight < 16;
	};

	useEffect(() => {
		const persisted = readPersistedTestCallPhone();
		if (persisted) setPhone(persisted);
		setEngine(readPersistedEngine());
	}, []);

	const handleEngineChange = (value: string) => {
		const next: CallEngine = value === "livekit" ? "livekit" : "stream";
		setEngine(next);
		persistEngine(next);
	};

	useEffect(() => {
		const normalized = normalizePhoneForStorage(phone);
		if (!normalized || !isValidPhoneNumber(normalized)) return;
		persistTestCallPhone(normalized);
	}, [phone]);

	const isActive = status === "in-call";
	const isBusy =
		status === "requesting-mic" ||
		status === "connecting" ||
		status === "in-call";
	const canCall = status === "idle" || status === "ended" || status === "error";
	const phoneValid = isValidPhoneNumber(phone);

	const handleCall = () => {
		if (!canCall) return;
		const stored = normalizePhoneForStorage(phone);
		if (!stored || !isValidPhoneNumber(stored)) return;
		void startCall(stored, settings);
	};

	const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === "Enter" && canCall && phoneValid) {
			handleCall();
		}
	};

	return (
		<div className="flex min-h-svh items-start justify-center bg-background p-4 lg:items-center">
			<div className="flex w-full max-w-4xl flex-col items-center gap-4 lg:flex-row lg:items-start lg:justify-center">
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
									{isActive
										? phone
											? formatPhoneDisplay(phone)
											: "Simulated Call"
										: "Test Call Simulator"}
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
							{isActive && recordingStatus === "recording" && (
								<div className="flex items-center gap-1.5 rounded-md bg-red-500/10 px-2 py-1">
									<span className="size-1.5 rounded-full bg-red-500 animate-pulse" />
									<span className="font-mono text-[10px] font-medium text-red-600 dark:text-red-400">
										REC
									</span>
								</div>
							)}
							<ThemeToggle className="shrink-0" />
						</div>

						{/* Transcript area */}
						<div
							ref={scrollRef}
							onScroll={handleTranscriptScroll}
							className="flex h-72 min-h-0 flex-col gap-3 overflow-y-auto p-4"
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
							<Tabs
								value={engine}
								onValueChange={handleEngineChange}
								className="mb-3"
							>
								<TabsList className="w-full">
									<TabsTrigger value="stream" disabled={isBusy}>
										Phone stream
									</TabsTrigger>
									<TabsTrigger value="livekit" disabled={isBusy}>
										LiveKit agent
									</TabsTrigger>
								</TabsList>
							</Tabs>
							<div className="flex gap-2">
								<PhoneNumberInput
									id="test-call-phone"
									value={phone}
									onChange={setPhone}
									onKeyDown={handleKey}
									disabled={isBusy}
									countries={TEST_CALL_PHONE_COUNTRY_OPTIONS}
									className="min-w-0 flex-1"
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
										disabled={!phoneValid}
										title="Call"
										className="bg-green-600 hover:bg-green-700"
									>
										<Phone className="size-4" />
									</Button>
								)}
							</div>

							{status === "ended" && recordingUrl && (
								<div className="mt-3 space-y-1.5">
									<div className="mb-2 font-medium text-muted-foreground text-xs uppercase tracking-wide">
										Recording
									</div>
									<AudioWaveformPlayer src={recordingUrl} />
									<p
										className={cn(
											"text-xs",
											recordingStatus === "error"
												? "text-destructive"
												: "text-muted-foreground",
										)}
									>
										{recordingStatus === "saving" && "Saving recording…"}
										{recordingStatus === "saved" && "Saved to the call log"}
										{recordingStatus === "error" && (
											<>
												Couldn't save the recording.{" "}
												<button
													type="button"
													className="underline"
													onClick={retryRecordingSave}
												>
													Try again
												</button>
											</>
										)}
									</p>
								</div>
							)}

							{status === "ended" && (
								<p className="mt-2 text-center text-muted-foreground text-xs">
									Call ended.{" "}
									<button
										type="button"
										className="underline"
										onClick={() => void startCall(phone, settings)}
									>
										Call again
									</button>
								</p>
							)}
						</div>
					</div>

					{/* Info note */}
					<p className="mt-4 text-center text-muted-foreground text-xs">
						{engine === "livekit"
							? "LiveKit agent: talks to the LiveKit pipeline over WebRTC (admin login required)."
							: "Phone stream: simulates a Twilio call to the voice server's current realtime model."}{" "}
						Bookings made here create real appointments. Use a dedicated test
						number.
					</p>
				</div>

				<ModelSettingsPanel
					engine={engine}
					disabled={isBusy}
					onChange={setSettings}
					className="w-full max-w-md lg:w-96"
				/>
			</div>
		</div>
	);
}
