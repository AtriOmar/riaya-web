"use client";

import { Phone, Volume2, VolumeX } from "lucide-react";
import { useCallback, useEffect, useRef } from "react";
import type { CallData } from "@/hooks/use-realtime-socket";
import { cn } from "@/lib/utils";
import { getTimelinePreview, useCallDuration } from "./call-helpers";
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

type Props = {
	call: CallData;
	isListening: boolean;
	onToggleListening: () => void;
	audioCallbackRef: React.MutableRefObject<
		((callSid: string, role: string, payload: string) => void) | null
	>;
	/** `drawer`: no card chrome; transcript fills the panel (e.g. admin sheet). */
	variant?: "default" | "drawer";
};

export default function CallCard({
	call,
	isListening,
	onToggleListening,
	audioCallbackRef,
	variant = "default",
}: Props) {
	const isDrawer = variant === "drawer";
	const duration = useCallDuration(call.startTime, call.endTime, call.duration);
	const isActive = call.status === "active";
	const preview = getTimelinePreview(call.timeline);
	const callerLabel = call.callerName || call.from || "Unknown caller";

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

	return (
		<div
			className={cn(
				"flex h-full min-h-0 min-w-0 flex-col overflow-hidden",
				!isDrawer && "rounded-xl border shadow-sm",
				!isDrawer &&
					(isActive
						? "border-primary/20 bg-card"
						: "border-border bg-muted/30"),
				isDrawer && "bg-background",
			)}
		>
			<div
				className={cn(
					"shrink-0 border-b",
					isDrawer ? "px-4 py-3" : "px-5 py-4",
				)}
			>
				<div className="flex flex-wrap items-start justify-between gap-3">
					<div className="flex min-w-0 flex-1 items-start gap-3">
						<div className="relative mt-0.5 shrink-0">
							<Phone
								className={cn(
									"size-6",
									isActive ? "text-primary" : "text-muted-foreground",
								)}
							/>
							{isActive && (
								<span className="-top-0.5 -right-0.5 absolute size-2.5 rounded-full bg-green-500 animate-pulse" />
							)}
						</div>
						<div className="min-w-0">
							<div className="flex flex-wrap items-center gap-2">
								<span
									className={cn(
										"rounded-full px-2 py-0.5 font-medium text-xs",
										isActive
											? "bg-primary/10 text-primary"
											: "bg-muted text-muted-foreground",
									)}
								>
									{isActive ? "Active" : "Ended"}
								</span>
								<span className="font-semibold text-base">{callerLabel}</span>
								<span className="font-mono text-muted-foreground text-sm tabular-nums">
									{duration}
								</span>
							</div>
							<p className="mt-1 text-muted-foreground text-sm">{preview}</p>
							<p className="mt-1 font-mono text-muted-foreground text-xs break-all">
								{call.callSid}
							</p>
						</div>
					</div>
					{isActive && (
						<button
							type="button"
							onClick={onToggleListening}
							className={cn(
								"shrink-0 rounded-lg p-2.5 transition-colors",
								isListening
									? "bg-primary/10 text-primary hover:bg-primary/20"
									: "bg-muted text-muted-foreground hover:bg-muted/80",
							)}
							title={isListening ? "Stop listening" : "Listen to call"}
						>
							{isListening ? (
								<Volume2 className="size-5" />
							) : (
								<VolumeX className="size-5" />
							)}
						</button>
					)}
				</div>
			</div>

			<div className="flex min-h-0 flex-1 flex-col overflow-hidden">
				{!isActive && call.recordingUrl && (
					<div
						className={cn(
							"shrink-0 border-b bg-muted/30",
							isDrawer ? "px-4 py-2.5" : "px-5 py-3",
						)}
					>
						<div className="mb-2 font-medium text-muted-foreground text-xs uppercase tracking-wide">
							Recording
						</div>
						{/** biome-ignore lint/a11y/useMediaCaption: no captions for call audio */}
						<audio controls src={call.recordingUrl} className="h-10 w-full" />
					</div>
				)}
				<CallTranscript
					timeline={call.timeline}
					isActive={isActive}
					variant={isDrawer ? "drawer" : "default"}
					scrollAreaClassName="min-h-0 flex-1"
				/>
			</div>
		</div>
	);
}
