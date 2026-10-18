/** biome-ignore-all lint/suspicious/noArrayIndexKey: fixed-length static bar layout, never reordered */
"use client";

/**
 * AudioWaveformPlayer
 *
 * A compact call-recording player: play/pause, a waveform scrubber (built
 * from decoded peaks, not a canvas library), current/total time and a mute
 * toggle. Falls back to a plain flat progress bar if the audio can't be
 * decoded for peaks (e.g. a CORS-blocked fetch) — playback itself always
 * goes through a plain <audio> element, so it never depends on decoding.
 */

import { Pause, Play, Volume2, VolumeX } from "lucide-react";
import {
	type RefObject,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";
import { cn } from "@/lib/utils";

const BAR_COUNT = 80;

function formatTime(seconds: number): string {
	if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
	const m = Math.floor(seconds / 60);
	const s = Math.floor(seconds % 60);
	return `${m}:${s.toString().padStart(2, "0")}`;
}

/** Downsamples decoded channel data into `BAR_COUNT` peak amplitudes (0–1). */
function computePeaks(buffer: AudioBuffer): number[] {
	const channel = buffer.getChannelData(0);
	const blockSize = Math.max(1, Math.floor(channel.length / BAR_COUNT));
	const peaks: number[] = [];
	let max = 0;
	for (let i = 0; i < BAR_COUNT; i++) {
		const start = i * blockSize;
		let peak = 0;
		for (let j = start; j < start + blockSize && j < channel.length; j++) {
			const abs = Math.abs(channel[j]);
			if (abs > peak) peak = abs;
		}
		peaks.push(peak);
		if (peak > max) max = peak;
	}
	// Normalize, ease the curve so quiet speech stays visible next to loud
	// peaks, and keep a floor so silence still draws a thin bar.
	return peaks.map((p) => (max > 0 ? Math.max((p / max) ** 0.7, 0.05) : 0.05));
}

export function AudioWaveformPlayer({
	src,
	waveformSrc,
	audioRef: externalAudioRef,
	className,
}: {
	src: string;
	/** Same-origin URL to decode for the waveform when `src` has no CORS. */
	waveformSrc?: string;
	/** Lets the parent drive the underlying element (e.g. seek from a transcript). */
	audioRef?: RefObject<HTMLAudioElement | null>;
	className?: string;
}) {
	const ownAudioRef = useRef<HTMLAudioElement | null>(null);
	const audioRef = externalAudioRef ?? ownAudioRef;
	const [peaks, setPeaks] = useState<number[] | null>(null);
	const [isPlaying, setIsPlaying] = useState(false);
	const [isMuted, setIsMuted] = useState(false);
	const [mediaDuration, setMediaDuration] = useState(0);
	const [decodedDuration, setDecodedDuration] = useState(0);
	const [currentTime, setCurrentTime] = useState(0);

	// Decode in the background to build the waveform; playback never waits on this.
	useEffect(() => {
		setPeaks(null);
		setDecodedDuration(0);
		let cancelled = false;
		const AudioCtx =
			window.AudioContext ||
			(window as unknown as { webkitAudioContext?: typeof AudioContext })
				.webkitAudioContext;
		if (!AudioCtx) return;

		(async () => {
			try {
				const res = await fetch(waveformSrc ?? src);
				if (!res.ok) return;
				const arrayBuffer = await res.arrayBuffer();
				const ctx = new AudioCtx();
				const decoded = await ctx.decodeAudioData(arrayBuffer);
				void ctx.close();
				if (cancelled) return;
				setPeaks(computePeaks(decoded));
				setDecodedDuration(decoded.duration);
			} catch {
				// No waveform — the flat fallback bar below still works.
			}
		})();

		return () => {
			cancelled = true;
		};
	}, [src, waveformSrc]);

	useEffect(() => {
		const audio = audioRef.current;
		if (!audio) return;
		const onTime = () => setCurrentTime(audio.currentTime);
		// MediaRecorder files (test calls) report Infinity until fully played.
		const onLoaded = () =>
			setMediaDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
		const onPlay = () => setIsPlaying(true);
		const onPause = () => setIsPlaying(false);
		const onEnded = () => {
			setIsPlaying(false);
			setCurrentTime(0);
		};
		audio.addEventListener("timeupdate", onTime);
		audio.addEventListener("loadedmetadata", onLoaded);
		audio.addEventListener("durationchange", onLoaded);
		audio.addEventListener("play", onPlay);
		audio.addEventListener("pause", onPause);
		audio.addEventListener("ended", onEnded);
		return () => {
			audio.removeEventListener("timeupdate", onTime);
			audio.removeEventListener("loadedmetadata", onLoaded);
			audio.removeEventListener("durationchange", onLoaded);
			audio.removeEventListener("play", onPlay);
			audio.removeEventListener("pause", onPause);
			audio.removeEventListener("ended", onEnded);
		};
	}, []);

	const togglePlay = useCallback(() => {
		const audio = audioRef.current;
		if (!audio) return;
		if (audio.paused) void audio.play();
		else audio.pause();
	}, []);

	const toggleMute = useCallback(() => {
		const audio = audioRef.current;
		if (!audio) return;
		audio.muted = !audio.muted;
		setIsMuted(audio.muted);
	}, []);

	const totalDuration = mediaDuration || decodedDuration;
	const seekToRatio = (ratio: number) => {
		const audio = audioRef.current;
		if (!audio || totalDuration <= 0) return;
		const next = Math.min(Math.max(ratio, 0), 1) * totalDuration;
		audio.currentTime = next;
		setCurrentTime(next);
	};

	const handleScrubPointer = (e: React.PointerEvent<HTMLButtonElement>) => {
		const rect = e.currentTarget.getBoundingClientRect();
		seekToRatio((e.clientX - rect.left) / rect.width);
	};

	const progress = totalDuration > 0 ? currentTime / totalDuration : 0;
	const bars = peaks ?? Array.from({ length: BAR_COUNT }, () => 0.3);

	return (
		<div className={cn("flex items-center gap-2.5", className)}>
			{/* biome-ignore lint/a11y/useMediaCaption: call audio, transcript shown alongside */}
			<audio ref={audioRef} src={src} preload="metadata" className="hidden" />

			<button
				type="button"
				onClick={togglePlay}
				className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-colors hover:bg-primary/90"
				title={isPlaying ? "Pause" : "Play"}
			>
				{isPlaying ? (
					<Pause className="size-3.5 fill-current" />
				) : (
					<Play className="size-3.5 fill-current" />
				)}
			</button>

			<button
				type="button"
				onPointerDown={handleScrubPointer}
				className="group relative flex h-8 min-w-0 flex-1 items-center gap-[2px] rounded-md px-0.5 outline-none"
				title="Seek"
			>
				{bars.map((amplitude, i) => (
					<span
						key={i}
						className={cn(
							"flex-1 rounded-full transition-colors",
							i / bars.length < progress
								? "bg-primary"
								: "bg-primary/25 group-hover:bg-primary/35",
						)}
						style={{ height: `${Math.max(amplitude * 100, 10)}%` }}
					/>
				))}
			</button>

			<span className="shrink-0 font-mono text-muted-foreground text-xs tabular-nums">
				{formatTime(currentTime)} / {formatTime(totalDuration)}
			</span>

			<button
				type="button"
				onClick={toggleMute}
				className="flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:text-foreground"
				title={isMuted ? "Unmute" : "Mute"}
			>
				{isMuted ? (
					<VolumeX className="size-3.5" />
				) : (
					<Volume2 className="size-3.5" />
				)}
			</button>
		</div>
	);
}
