"use client";

import { MediaRecorder, register } from "extendable-media-recorder";
import { connect } from "extendable-media-recorder-wav-encoder";
import {
	Check,
	Loader2,
	Mic,
	RefreshCw,
	Square,
	Trash2,
	User,
	X,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AudioWaveformPlayer } from "@/components/ui/audio-waveform-player";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { getErrorMessage } from "@/lib/error-handling";
import {
	clearRecordingDraft,
	loadRecordingDraft,
	saveRecordingDraftPiece,
	setRecordingDraftActive,
} from "@/lib/recording-draft";
import { formatRecordingTime } from "@/lib/recording-time";
import { uploadBlobToR2 } from "@/lib/upload";
import type { GetApiPatients200Item } from "@/services/generated/api.schemas";
import { useGetApiBillingSubscription } from "@/services/generated/billing/billing";
import { useGetApiPatients } from "@/services/generated/patients/patients";
import { usePostApiRecordings } from "@/services/generated/recordings/recordings";

/** Stopping saves right away; `failed` keeps the audio so nothing is lost. */
type RecordingState = "idle" | "recording" | "saving" | "failed";

/** Shorter recordings are treated as a mis-tap and not saved. */
const MIN_RECORDING_SECONDS = 2;
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

	// Local backup (see lib/recording-draft): audio not yet copied, the next
	// piece number, and a chain that keeps the writes in order.
	const unsavedChunksRef = useRef<Blob[]>([]);
	const pieceIndexRef = useRef(0);
	const draftWritesRef = useRef<Promise<void>>(Promise.resolve());
	const startedAtRef = useRef("");
	const backupTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
	// Latest details for the backup, read from inside recorder callbacks
	const draftDetailsRef = useRef({
		title: "",
		patientId: null as number | null,
		durationSeconds: 0,
	});
	draftDetailsRef.current = {
		title,
		patientId: selectedPatient?.id ?? null,
		durationSeconds,
	};

	const { data: patients = [] } = useGetApiPatients();
	const { trigger: createRecording } = usePostApiRecordings();
	const { data: billing, mutate: refreshBilling } =
		useGetApiBillingSubscription();
	const recordingTime = billing?.plan.recordingTime;
	const outOfTime =
		recordingTime != null && recordingTime.remainingSeconds <= 0;

	/** Copies the audio recorded since the last copy into the local backup. */
	const backUpAudio = useCallback((mimeType: string) => {
		if (unsavedChunksRef.current.length === 0) return draftWritesRef.current;
		const piece = new Blob(unsavedChunksRef.current, { type: mimeType });
		unsavedChunksRef.current = [];
		const index = pieceIndexRef.current++;
		draftWritesRef.current = draftWritesRef.current.then(() =>
			saveRecordingDraftPiece(index, piece, {
				startedAt: startedAtRef.current,
				mimeType,
				...draftDetailsRef.current,
			}),
		);
		return draftWritesRef.current;
	}, []);

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			if (timerRef.current) clearInterval(timerRef.current);
			if (audioUrl) URL.revokeObjectURL(audioUrl);
		};
	}, [audioUrl]);

	// Leaving the panel mid-recording stops it, which saves it in the background
	const mountedRef = useRef(true);
	useEffect(() => {
		mountedRef.current = true;
		return () => {
			mountedRef.current = false;
			if (mediaRecorderRef.current?.state === "recording") {
				mediaRecorderRef.current.stop();
			}
		};
	}, []);

	// Ask before closing the tab while a recording isn't saved yet
	useEffect(() => {
		if (recordingState !== "recording" && recordingState !== "saving") return;
		const warn = (e: BeforeUnloadEvent) => {
			e.preventDefault();
			e.returnValue = "";
		};
		window.addEventListener("beforeunload", warn);
		return () => window.removeEventListener("beforeunload", warn);
	}, [recordingState]);

	const startRecording = useCallback(async () => {
		setMicError(null);
		// Never overwrite a recording that wasn't saved last time
		if (await loadRecordingDraft()) {
			toast.error(
				"A previous recording wasn't saved. Save or discard it first (see the top of the list).",
			);
			return;
		}
		try {
			if (!isWavEncoderRegistered) {
				await register(await connect());
				isWavEncoderRegistered = true;
			}
			const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
			const mimeType = "audio/wav";
			const recorder = new MediaRecorder(stream, { mimeType });

			chunksRef.current = [];
			unsavedChunksRef.current = [];
			pieceIndexRef.current = 0;
			startedAtRef.current = new Date().toISOString();
			setRecordingDraftActive(true);
			recorder.ondataavailable = (e) => {
				if (e.data.size > 0) {
					chunksRef.current.push(e.data);
					unsavedChunksRef.current.push(e.data);
				}
			};
			recorder.onstop = () => {
				const blob = new Blob(chunksRef.current, { type: mimeType });
				// Stop all mic tracks
				for (const track of stream.getTracks()) track.stop();
				if (backupTimerRef.current) clearInterval(backupTimerRef.current);
				// Back up the last seconds too, in case saving fails and the tab closes
				void backUpAudio(mimeType).then(() => saveRef.current(blob));
			};

			recorder.start(250); // 250ms timeslices for smoother data
			mediaRecorderRef.current = recorder;
			setDurationSeconds(0);
			setRecordingState("recording");

			timerRef.current = setInterval(() => {
				setDurationSeconds((d) => d + 1);
			}, 1000);
			backupTimerRef.current = setInterval(() => {
				void backUpAudio(mimeType);
			}, 2000);
		} catch {
			setMicError(
				"Microphone access denied. Please allow microphone access and try again.",
			);
		}
	}, [backUpAudio]);

	const stopRecording = useCallback(() => {
		if (timerRef.current) {
			clearInterval(timerRef.current);
			timerRef.current = null;
		}
		if (mediaRecorderRef.current?.state !== "inactive") {
			mediaRecorderRef.current?.stop();
		}
		setRecordingState("saving");
	}, []);

	const discardRecording = useCallback(() => {
		void clearRecordingDraft();
		setRecordingDraftActive(false);
		if (audioUrl) URL.revokeObjectURL(audioUrl);
		setAudioBlob(null);
		setAudioUrl(null);
		setDurationSeconds(0);
		setRecordingState("idle");
	}, [audioUrl]);

	/** Uploads and saves the recording; on failure keeps it for a retry. */
	const saveRecording = useCallback(
		async (blob: Blob) => {
			if (durationSeconds < MIN_RECORDING_SECONDS) {
				await clearRecordingDraft();
				setRecordingDraftActive(false);
				toast.info("Too short to save. Tap the microphone to record again.");
				setRecordingState("idle");
				setDurationSeconds(0);
				return;
			}

			setAudioBlob(blob);
			setRecordingState("saving");
			try {
				// 1. Upload audio to R2
				const filename = `recording-${Date.now()}.wav`;
				const cdnUrl = await uploadBlobToR2(blob, filename, "recordings");

				// 2. Save recording row in DB
				const recording = await createRecording({
					audioUrl: cdnUrl,
					title: title.trim() || undefined,
					durationSeconds,
					patientId: selectedPatient?.id ?? undefined,
				});

				// Saved: the local copy isn't needed anymore
				await clearRecordingDraft();
				setRecordingDraftActive(false);
				toast.success("Recording saved");
				void refreshBilling();
				// Don't pull the doctor back here if they've moved on
				if (mountedRef.current) onSaved(recording.id);
			} catch (err) {
				toast.error(getErrorMessage(err, "Couldn't save the recording."));
				setAudioUrl((prev) => prev ?? URL.createObjectURL(blob));
				setRecordingState("failed");
			}
		},
		[
			durationSeconds,
			title,
			selectedPatient,
			createRecording,
			refreshBilling,
			onSaved,
		],
	);

	// The recorder's onstop is created once; it always calls the latest save
	const saveRef = useRef(saveRecording);
	saveRef.current = saveRecording;

	const isSaving = recordingState === "saving";

	return (
		<div className="flex flex-col">
			{/* Header */}
			<div className="top-0 z-10 sticky flex items-start gap-3 bg-card px-6 pt-5 pb-4 border-b">
				<div className="flex-1 min-w-0">
					<h2 className="font-semibold text-lg">New recording</h2>
					<p className="mt-1 text-muted-foreground text-sm">
						Record a consultation. It's saved as soon as you stop, then
						transcribed automatically.
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
					<Label htmlFor="title">
						Title{" "}
						<span className="font-normal text-muted-foreground">
							(optional)
						</span>
					</Label>
					<Input
						id="title"
						placeholder="Leave empty to name it automatically"
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
					<div className="w-full rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 text-left">
						<p className="font-medium text-amber-900 text-sm dark:text-amber-200">
							No transcription time left this month
						</p>
						<p className="mt-0.5 text-amber-900/80 text-xs dark:text-amber-200/80">
							You can still record. It's saved to the patient's history and you
							can transcribe it once you have time again.{" "}
							<Link
								href={
									billing.plan.canBuyRecordingPacks
										? "/dashboard/subscription?addHours=1"
										: "/dashboard/subscription"
								}
								className="font-medium underline underline-offset-2"
							>
								{billing.plan.canBuyRecordingPacks
									? "Add hours"
									: "Upgrade to Pro"}
							</Link>
						</p>
					</div>
				)}

				{recordingState === "idle" && (
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
							{recordingTime && !outOfTime && (
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

				{isSaving && (
					<div className="flex items-center gap-2 py-6 text-muted-foreground text-sm">
						<Loader2 className="size-4 animate-spin" />
						Saving the recording…
					</div>
				)}

				{recordingState === "failed" && audioBlob && audioUrl && (
					<div className="space-y-3 w-full">
						<p className="text-red-600 text-sm dark:text-red-400">
							The recording couldn't be saved. It's still here: try again.
						</p>
						<AudioWaveformPlayer src={audioUrl} />
						<div className="flex gap-2">
							<Button
								className="flex-1 gap-2"
								onClick={() => void saveRecording(audioBlob)}
							>
								<RefreshCw className="size-4" />
								Try again
							</Button>
							<Button
								variant="ghost"
								className="gap-1.5 text-muted-foreground hover:text-destructive"
								onClick={discardRecording}
							>
								<Trash2 className="size-4" />
								Discard
							</Button>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
