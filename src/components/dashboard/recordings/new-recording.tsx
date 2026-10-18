"use client";

import { MediaRecorder, register } from "extendable-media-recorder";
import { connect } from "extendable-media-recorder-wav-encoder";
import {
	Check,
	Clock,
	Loader2,
	Mic,
	RotateCcw,
	Square,
	User,
	X,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { getErrorMessage } from "@/lib/error-handling";
import { formatRecordingTime } from "@/lib/recording-time";
import { uploadBlobToR2 } from "@/lib/upload";
import type { GetApiPatients200Item } from "@/services/generated/api.schemas";
import { useGetApiBillingSubscription } from "@/services/generated/billing/billing";
import { useGetApiPatients } from "@/services/generated/patients/patients";
import { usePostApiRecordings } from "@/services/generated/recordings/recordings";

type RecordingState = "idle" | "recording" | "stopped" | "saving";
let isWavEncoderRegistered = false;

function formatDuration(seconds: number) {
	const m = Math.floor(seconds / 60);
	const s = seconds % 60;
	return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// ─── Patient combobox ─────────────────────────────────────────────────────────

function PatientCombobox({
	patients,
	selected,
	onSelect,
}: {
	patients: GetApiPatients200Item[];
	selected: GetApiPatients200Item | null;
	onSelect: (p: GetApiPatients200Item | null) => void;
}) {
	const [open, setOpen] = useState(false);
	const [search, setSearch] = useState("");

	const filtered = patients.filter((p) => {
		const name = `${p.firstName ?? ""} ${p.lastName ?? ""}`.toLowerCase();
		const cin = (p.cin ?? "").toLowerCase();
		return (
			name.includes(search.toLowerCase()) || cin.includes(search.toLowerCase())
		);
	});

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button
					variant="outline"
					role="combobox"
					aria-expanded={open}
					className="w-full justify-between"
				>
					<span className="flex items-center gap-2">
						<User className="size-4 text-muted-foreground" />
						{selected
							? `${selected.firstName ?? ""} ${selected.lastName ?? ""}`.trim() ||
								"(unnamed)"
							: "Select patient (optional)"}
					</span>
				</Button>
			</PopoverTrigger>
			<PopoverContent className="w-72 p-0" align="start">
				<div className="border-b p-2">
					<Input
						placeholder="Search by name or CIN…"
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						className="h-8 border-0 shadow-none focus-visible:ring-0"
					/>
				</div>
				<div className="max-h-56 overflow-y-auto py-1">
					{selected && (
						<button
							type="button"
							className="flex w-full items-center gap-2 px-3 py-2 text-muted-foreground text-sm hover:bg-accent"
							onClick={() => {
								onSelect(null);
								setOpen(false);
							}}
						>
							Clear selection
						</button>
					)}
					{filtered.length === 0 && (
						<p className="px-3 py-4 text-center text-muted-foreground text-sm">
							No patients found
						</p>
					)}
					{filtered.map((p) => {
						const name =
							`${p.firstName ?? ""} ${p.lastName ?? ""}`.trim() || "(unnamed)";
						return (
							<button
								key={p.id}
								type="button"
								className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent"
								onClick={() => {
									onSelect(p);
									setOpen(false);
									setSearch("");
								}}
							>
								{selected?.id === p.id && (
									<Check className="size-4 shrink-0 text-primary" />
								)}
								<span className="ml-auto flex-1 text-left">{name}</span>
								{p.cin && (
									<span className="text-muted-foreground text-xs">{p.cin}</span>
								)}
							</button>
						);
					})}
				</div>
			</PopoverContent>
		</Popover>
	);
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function NewRecording({
	onClose,
	onSaved,
}: {
	/** Shows a close button in the header. */
	onClose?: () => void;
	/** Called with the new recording's id once it is saved. */
	onSaved: (recordingId: number) => void;
}) {
	// Form state
	const [title, setTitle] = useState("");
	const [selectedPatient, setSelectedPatient] =
		useState<GetApiPatients200Item | null>(null);

	// Recording state
	const [recordingState, setRecordingState] = useState<RecordingState>("idle");
	const [durationSeconds, setDurationSeconds] = useState(0);
	const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
	const [audioUrl, setAudioUrl] = useState<string | null>(null);

	// Mic permission
	const [micError, setMicError] = useState<string | null>(null);

	const mediaRecorderRef = useRef<any>(null);
	const chunksRef = useRef<Blob[]>([]);
	const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

	const { data: patients = [] } = useGetApiPatients();
	const { trigger: createRecording } = usePostApiRecordings();
	const { data: billing, mutate: refreshBilling } =
		useGetApiBillingSubscription();
	const recordingTime = billing?.plan.recordingTime;
	const outOfTime =
		recordingTime != null && recordingTime.remainingSeconds <= 0;

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			if (timerRef.current) clearInterval(timerRef.current);
			if (audioUrl) URL.revokeObjectURL(audioUrl);
		};
	}, [audioUrl]);

	const startRecording = useCallback(async () => {
		setMicError(null);
		try {
			if (!isWavEncoderRegistered) {
				await register(await connect());
				isWavEncoderRegistered = true;
			}
			const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
			const mimeType = "audio/wav";
			const recorder = new MediaRecorder(stream, { mimeType });

			chunksRef.current = [];
			recorder.ondataavailable = (e) => {
				if (e.data.size > 0) chunksRef.current.push(e.data);
			};
			recorder.onstop = () => {
				const blob = new Blob(chunksRef.current, { type: mimeType });
				setAudioBlob(blob);
				const url = URL.createObjectURL(blob);
				setAudioUrl(url);
				// Stop all mic tracks
				for (const track of stream.getTracks()) track.stop();
			};

			recorder.start(250); // 250ms timeslices for smoother data
			mediaRecorderRef.current = recorder;
			setDurationSeconds(0);
			setRecordingState("recording");

			timerRef.current = setInterval(() => {
				setDurationSeconds((d) => d + 1);
			}, 1000);
		} catch {
			setMicError(
				"Microphone access denied. Please allow microphone access and try again.",
			);
		}
	}, []);

	const stopRecording = useCallback(() => {
		if (timerRef.current) {
			clearInterval(timerRef.current);
			timerRef.current = null;
		}
		if (mediaRecorderRef.current?.state !== "inactive") {
			mediaRecorderRef.current?.stop();
		}
		setRecordingState("stopped");
	}, []);

	const discardRecording = useCallback(() => {
		if (audioUrl) URL.revokeObjectURL(audioUrl);
		setAudioBlob(null);
		setAudioUrl(null);
		setDurationSeconds(0);
		setRecordingState("idle");
	}, [audioUrl]);

	const saveRecording = useCallback(async () => {
		if (!audioBlob) return;
		if (!title.trim()) {
			toast.error("Please give this recording a title");
			return;
		}

		setRecordingState("saving");
		try {
			// 1. Upload audio to R2
			const ext = "wav";
			const filename = `recording-${Date.now()}.${ext}`;
			const cdnUrl = await uploadBlobToR2(audioBlob, filename, "recordings");

			// 2. Save recording row in DB
			const recording = await createRecording({
				audioUrl: cdnUrl,
				title: title.trim(),
				durationSeconds,
				patientId: selectedPatient?.id ?? undefined,
			});

			toast.success("Recording saved");
			void refreshBilling();
			onSaved(recording.id);
		} catch (err) {
			toast.error(getErrorMessage(err, "Failed to save recording"));
			setRecordingState("stopped");
		}
	}, [
		audioBlob,
		title,
		durationSeconds,
		selectedPatient,
		createRecording,
		refreshBilling,
		onSaved,
	]);

	const isFormComplete = title.trim().length > 0;

	const isSaving = recordingState === "saving";
	const hasAudio =
		(recordingState === "stopped" || isSaving) && Boolean(audioUrl);

	return (
		<div className="flex flex-col">
			{/* Header */}
			<div className="top-0 z-10 sticky flex items-start gap-3 bg-card px-6 pt-5 pb-4 border-b">
				<div className="flex-1 min-w-0">
					<h2 className="font-semibold text-lg">New recording</h2>
					<p className="mt-1 text-muted-foreground text-sm">
						Record a consultation. It's transcribed automatically once saved.
					</p>
				</div>
				{onClose && (
					<Button
						variant="ghost"
						size="icon-sm"
						className="-mr-2 shrink-0 text-muted-foreground"
						aria-label="Close"
						onClick={onClose}
					>
						<X className="size-4" />
					</Button>
				)}
			</div>

			<div className="space-y-5 px-6 pt-5">
				<div className="space-y-1.5">
					<Label htmlFor="title">Title</Label>
					<Input
						id="title"
						placeholder="e.g. Initial consultation"
						value={title}
						onChange={(e) => setTitle(e.target.value)}
						disabled={isSaving}
					/>
				</div>

				<div className="space-y-1.5">
					<Label>
						Patient{" "}
						<span className="font-normal text-muted-foreground">
							(optional)
						</span>
					</Label>
					<PatientCombobox
						patients={patients}
						selected={selectedPatient}
						onSelect={setSelectedPatient}
					/>
				</div>
			</div>

			{/* Recorder */}
			<div className="flex flex-col items-center gap-4 mt-6 px-6 pt-8 pb-8 border-t text-center">
				{micError && (
					<p className="bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-md w-full text-red-700 dark:text-red-300 text-sm">
						{micError}
					</p>
				)}

				{recordingState === "idle" && outOfTime && billing && (
					<div className="space-y-3 py-2">
						<div className="flex justify-center items-center bg-muted mx-auto rounded-full size-14 text-muted-foreground">
							<Clock className="size-6" />
						</div>
						<div>
							<p className="font-medium text-sm">
								You've used your recording time this month
							</p>
							<p className="text-muted-foreground text-xs">
								{billing.plan.canBuyRecordingPacks
									? "Add hours to keep recording. They never expire."
									: "Upgrade to Pro for 100 hours a month."}
							</p>
						</div>
						<Button asChild size="sm">
							<Link
								href={
									billing.plan.canBuyRecordingPacks
										? "/dashboard/subscription?addHours=1"
										: "/dashboard/subscription"
								}
							>
								{billing.plan.canBuyRecordingPacks
									? "Add recording hours"
									: "Upgrade to Pro"}
							</Link>
						</Button>
					</div>
				)}

				{recordingState === "idle" && !outOfTime && (
					<>
						<button
							type="button"
							onClick={startRecording}
							aria-label="Start recording"
							className="flex justify-center items-center bg-primary hover:bg-primary/90 shadow-md hover:shadow-lg rounded-full focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30 size-20 text-primary-foreground active:scale-95 transition-all cursor-pointer"
						>
							<Mic className="size-8" />
						</button>
						<div>
							<p className="font-medium text-sm">Tap to start recording</p>
							<p className="text-muted-foreground text-xs">
								Your browser will ask for microphone access
							</p>
							{recordingTime && (
								<p className="mt-1 text-muted-foreground text-xs">
									{formatRecordingTime(recordingTime.remainingSeconds)} of
									recording left
								</p>
							)}
						</div>
					</>
				)}

				{recordingState === "recording" && (
					<>
						<button
							type="button"
							onClick={stopRecording}
							aria-label="Stop recording"
							className="relative flex justify-center items-center bg-red-600 hover:bg-red-700 shadow-md rounded-full focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-red-500/30 size-20 text-white active:scale-95 transition-all cursor-pointer"
						>
							<span className="absolute inset-0 bg-red-500/30 rounded-full animate-ping" />
							<Square className="relative fill-current size-6" />
						</button>
						<div>
							<p className="font-mono font-semibold tabular-nums text-2xl">
								{formatDuration(durationSeconds)}
							</p>
							<p className="flex justify-center items-center gap-1.5 text-muted-foreground text-xs">
								<span className="bg-red-600 rounded-full size-1.5 animate-pulse" />
								Recording · tap to stop
							</p>
						</div>
					</>
				)}

				{hasAudio && audioUrl && (
					<div className="space-y-3 w-full">
						<div className="flex justify-between items-center text-sm">
							<span className="font-medium">
								Recording ·{" "}
								<span className="tabular-nums text-muted-foreground">
									{formatDuration(durationSeconds)}
								</span>
							</span>
							<Button
								variant="ghost"
								size="sm"
								className="gap-1.5 -mr-2 text-muted-foreground hover:text-destructive"
								onClick={discardRecording}
								disabled={isSaving}
							>
								<RotateCcw className="size-3.5" />
								Record again
							</Button>
						</div>
						{/* biome-ignore lint/a11y/useMediaCaption: recording preview */}
						<audio src={audioUrl} controls className="w-full" />
						<Button
							className="gap-2 w-full"
							onClick={saveRecording}
							disabled={!isFormComplete || isSaving}
						>
							{isSaving ? (
								<Loader2 className="size-4 animate-spin" />
							) : (
								<Check className="size-4" />
							)}
							{isSaving ? "Saving…" : "Save recording"}
						</Button>
						{!isFormComplete && (
							<p className="text-muted-foreground text-xs">
								Add a title to save this recording
							</p>
						)}
					</div>
				)}
			</div>
		</div>
	);
}
