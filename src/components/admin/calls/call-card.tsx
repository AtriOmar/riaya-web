"use client";

import { ChevronDown, ChevronUp, Phone, Volume2, VolumeX } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import CallTranscript from "./call-transcript";

// µ-law to 16-bit PCM lookup table (ITU-T G.711)
const ULAW_DECODE_TABLE = new Int16Array(256);
(() => {
	for (let i = 0; i < 256; i++) {
		const mu = ~i & 0xff;
		const sign = mu & 0x80;
		const exponent = (mu >> 4) & 0x07;
		const mantissa = mu & 0x0f;
		let sample = ((mantissa << 3) + 0x84) << exponent;
		sample -= 0x84;
		ULAW_DECODE_TABLE[i] = sign ? -sample : sample;
	}
})();

function decodeUlaw(base64Data: string): Float32Array {
	const binaryStr = atob(base64Data);
	const bytes = new Uint8Array(binaryStr.length);
	for (let i = 0; i < binaryStr.length; i++) {
		bytes[i] = binaryStr.charCodeAt(i);
	}
	const pcm = new Float32Array(bytes.length);
	for (let i = 0; i < bytes.length; i++) {
		pcm[i] = ULAW_DECODE_TABLE[bytes[i]] / 32768;
	}
	return pcm;
}

function useDuration(startTime?: string, endTime?: string) {
	const [elapsed, setElapsed] = useState(0);

	useEffect(() => {
		if (!startTime) return;
		if (endTime) {
			setElapsed(
				Math.floor(
					(new Date(endTime).getTime() - new Date(startTime).getTime()) / 1000,
				),
			);
			return;
		}
		const start = new Date(startTime).getTime();
		const interval = setInterval(() => {
			setElapsed(Math.floor((Date.now() - start) / 1000));
		}, 1000);
		return () => clearInterval(interval);
	}, [startTime, endTime]);

	const minutes = Math.floor(elapsed / 60);
	const seconds = elapsed % 60;
	return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

type CallData = {
	callSid: string;
	startTime: string;
	status: "active" | "ended";
	endTime?: string;
	transcript: {
		role: "patient" | "ai" | "system";
		text: string;
		timestamp: number;
	}[];
	patientName: string | null;
	functionCalls: unknown[];
};

type Props = {
	call: CallData;
	isListening: boolean;
	onToggleListening: () => void;
	audioCallbackRef: React.MutableRefObject<
		((callSid: string, role: string, payload: string) => void) | null
	>;
};

export default function CallCard({
	call,
	isListening,
	onToggleListening,
	audioCallbackRef,
}: Props) {
	const [expanded, setExpanded] = useState(false);
	const duration = useDuration(call.startTime, call.endTime);
	const isActive = call.status === "active";

	useEffect(() => {
		if (isActive) setExpanded(true);
	}, [isActive]);

	const audioContextRef = useRef<AudioContext | null>(null);
	const nextPlayTimeRef = useRef(0);

	useEffect(() => {
		if (!isListening) {
			audioContextRef.current?.close();
			audioContextRef.current = null;
			nextPlayTimeRef.current = 0;
			return;
		}
		const ctx = new AudioContext({ sampleRate: 8000 });
		audioContextRef.current = ctx;
		nextPlayTimeRef.current = ctx.currentTime;
		return () => {
			ctx.close();
			audioContextRef.current = null;
			nextPlayTimeRef.current = 0;
		};
	}, [isListening]);

	const handleAudio = useCallback(
		(callSid: string, _role: string, payload: string) => {
			if (callSid !== call.callSid || !isListening) return;
			const ctx = audioContextRef.current;
			if (!ctx || ctx.state === "closed") return;
			try {
				const pcm = decodeUlaw(payload);
				const buffer = ctx.createBuffer(1, pcm.length, 8000);
				buffer.getChannelData(0).set(pcm);
				const source = ctx.createBufferSource();
				source.buffer = buffer;
				source.connect(ctx.destination);
				const now = ctx.currentTime;
				if (nextPlayTimeRef.current < now) nextPlayTimeRef.current = now;
				source.start(nextPlayTimeRef.current);
				nextPlayTimeRef.current += buffer.duration;
			} catch {
				// ignore decode errors
			}
		},
		[call.callSid, isListening],
	);

	useEffect(() => {
		if (!isListening) return;
		const prevCallback = audioCallbackRef.current;
		audioCallbackRef.current = (callSid, role, payload) => {
			if (prevCallback && prevCallback !== audioCallbackRef.current) {
				prevCallback(callSid, role, payload);
			}
			handleAudio(callSid, role, payload);
		};
		return () => {
			audioCallbackRef.current = prevCallback;
		};
	}, [isListening, handleAudio, audioCallbackRef]);

	const lastTranscript = call.transcript[call.transcript.length - 1];
	const preview = lastTranscript
		? `${lastTranscript.role === "ai" ? "AI" : lastTranscript.role === "patient" ? "Patient" : "System"}: ${lastTranscript.text}`
		: "Waiting for conversation...";

	return (
		<div
			className={`border rounded-xl overflow-hidden shadow-sm transition-all ${
				isActive
					? "border-primary/20 bg-card"
					: "border-border bg-muted/50 opacity-75"
			}`}
		>
			{/* Header */}
			{/* biome-ignore lint/a11y/useSemanticElements: header contains nested interactive buttons which cannot be nested in a <button> */}
			<div
				className="flex justify-between items-center px-5 py-4 cursor-pointer select-none"
				onClick={() => setExpanded(!expanded)}
				onKeyDown={(e) => {
					if (e.key === "Enter" || e.key === " ") setExpanded(!expanded);
				}}
				role="button"
				tabIndex={0}
			>
				<div className="flex items-center gap-3 min-w-0">
					<div className="relative">
						<Phone
							className={`size-5 ${isActive ? "text-primary" : "text-muted-foreground"}`}
						/>
						{isActive && (
							<span className="-top-0.5 -right-0.5 absolute size-2.5 rounded-full bg-green-500 animate-pulse" />
						)}
					</div>
					<div className="min-w-0">
						<div className="flex items-center gap-2">
							<span
								className={`text-xs font-medium px-2 py-0.5 rounded-full ${
									isActive
										? "bg-primary/10 text-primary"
										: "bg-muted text-muted-foreground"
								}`}
							>
								{isActive ? "Active" : "Ended"}
							</span>
							<span className="font-mono text-muted-foreground text-sm">
								{duration}
							</span>
							<span className="hidden sm:inline text-muted-foreground text-xs">
								{call.callSid?.slice(0, 16)}...
							</span>
						</div>
						<p className="max-w-[400px] mt-1 text-muted-foreground text-sm truncate">
							{preview}
						</p>
					</div>
				</div>

				<div className="flex items-center gap-2 ml-4 shrink-0">
					{isActive && (
						<button
							type="button"
							onClick={(e) => {
								e.stopPropagation();
								onToggleListening();
							}}
							className={`p-2 rounded-lg transition-colors ${
								isListening
									? "bg-primary/10 text-primary hover:bg-primary/20"
									: "bg-muted text-muted-foreground hover:bg-muted/80"
							}`}
							title={isListening ? "Stop listening" : "Listen to call"}
						>
							{isListening ? (
								<Volume2 className="size-5" />
							) : (
								<VolumeX className="size-5" />
							)}
						</button>
					)}
					{expanded ? (
						<ChevronUp className="size-5 text-muted-foreground" />
					) : (
						<ChevronDown className="size-5 text-muted-foreground" />
					)}
				</div>
			</div>

			{/* Expanded transcript */}
			{expanded && (
				<div className="border-t">
					<CallTranscript transcript={call.transcript} isActive={isActive} />
				</div>
			)}
		</div>
	);
}
