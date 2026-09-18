"use client";

import { MediaRecorder, register } from "extendable-media-recorder";
import { connect } from "extendable-media-recorder-wav-encoder";
import {
	Check,
	ChevronLeft,
	Loader2,
	Mic,
	MicOff,
	Play,
	Square,
	User,
} from "lucide-react";
import { useRouter } from "next/navigation";
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
import { uploadBlobToR2 } from "@/lib/upload";
import type { GetApiPatients200Item } from "@/services/generated/api.schemas";
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
	onCancel,
	onSaved,
}: {
	/** Panel mode: close without navigating. */
	onCancel?: () => void;
	/** Panel mode: open the saved recording instead of navigating. */
	onSaved?: (recordingId: number) => void;
}) {
	const router = useRouter();

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
			// Preflight plan limit before uploading (server still enforces on create)
			const subRes = await fetch("/api/billing/subscription");
			if (subRes.ok) {
				const sub = (await subRes.json()) as {
					limits?: { recordingsPerMonth?: number | null };
					usage?: { recordingsThisMonth?: number };
				};
				const limit = sub.limits?.recordingsPerMonth;
				const used = sub.usage?.recordingsThisMonth ?? 0;
				if (limit != null && used >= limit) {
					toast.error(
						"Monthly conversation recording limit reached. It resets next calendar month, or upgrade to Pro for unlimited recordings.",
					);
					setRecordingState("stopped");
					return;
				}
			}

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
			const id = recording?.id;
			if (id && onSaved) {
				onSaved(id);
			} else if (id) {
				router.push(`/dashboard/recordings?id=${id}`);
			} else {
				router.push("/dashboard/recordings");
			}
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
		router,
		onSaved,
	]);

	const isFormComplete = title.trim().length > 0;

	const goBack = () => {
		if (onCancel) onCancel();
		else router.push("/dashboard/recordings");
	};

	return (
		<div className={onCancel ? "px-4 pb-6 sm:px-6" : "mx-auto max-w-xl"}>
			{!onCancel && (
				<Button
					variant="ghost"
					className="mb-6 -ml-2 gap-1.5 text-muted-foreground"
					onClick={goBack}
				>
					<ChevronLeft className="size-4" />
					Back to recordings
				</Button>
			)}

			{onCancel && (
				<div className="mb-4">
					<h2 className="font-semibold text-lg">New Recording</h2>
					<p className="text-muted-foreground text-sm">
						Record a consultation and save it to your library
					</p>
				</div>
			)}

			<div className="space-y-6 rounded-xl border bg-card p-6">
				{/* Title */}
				<div className="space-y-1.5">
					<Label htmlFor="title">Recording title</Label>
					<Input
						id="title"
						placeholder="e.g. Initial consultation – Dr. Smith"
						value={title}
						onChange={(e) => setTitle(e.target.value)}
						disabled={recordingState === "saving"}
					/>
				</div>

				{/* Patient */}
				<div className="space-y-1.5">
					<Label>Patient (optional)</Label>
					<PatientCombobox
						patients={patients}
						selected={selectedPatient}
						onSelect={setSelectedPatient}
					/>
					<p className="text-muted-foreground text-xs">
						You can also assign a patient later.
					</p>
				</div>

				{/* Recorder */}
				<div className="space-y-3">
					<Label>Audio recording</Label>

					{micError && (
						<div className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-700 text-sm dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
							{micError}
						</div>
					)}

					{/* Recording UI */}
					{recordingState === "idle" && (
						<div className="flex flex-col items-center gap-4 rounded-xl border border-dashed py-8">
							<div className="flex size-16 items-center justify-center rounded-full bg-primary/10">
								<Mic className="size-8 text-primary" />
							</div>
							<p className="text-muted-foreground text-sm">
								Press record to start capturing the conversation
							</p>
							<Button onClick={startRecording} className="gap-2">
								<Mic className="size-4" />
								Start Recording
							</Button>
						</div>
					)}

					{recordingState === "recording" && (
						<div className="flex flex-col items-center gap-4 rounded-xl border border-red-200 bg-red-50/50 py-8 dark:border-red-900/40 dark:bg-red-900/10">
							<div className="relative flex size-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
								<Mic className="size-8 text-red-600 dark:text-red-400" />
								{/* Pulse ring */}
								<span className="absolute inset-0 animate-ping rounded-full bg-red-400/30" />
							</div>
							<div className="text-center">
								<p className="font-mono text-2xl font-bold text-red-600 dark:text-red-400">
									{formatDuration(durationSeconds)}
								</p>
								<p className="text-muted-foreground text-xs">Recording…</p>
							</div>
							<Button
								variant="destructive"
								onClick={stopRecording}
								className="gap-2"
							>
								<Square className="size-4" />
								Stop Recording
							</Button>
						</div>
					)}

					{(recordingState === "stopped" || recordingState === "saving") &&
						audioUrl && (
							<div className="space-y-3 rounded-xl border p-4">
								<div className="flex items-center justify-between">
									<div className="flex items-center gap-2 text-sm">
										<MicOff className="size-4 text-muted-foreground" />
										<span className="font-medium">Recording complete</span>
										<span className="text-muted-foreground">
											({formatDuration(durationSeconds)})
										</span>
									</div>
									<Button
										variant="ghost"
										size="sm"
										className="h-7 px-2 text-muted-foreground text-xs hover:text-destructive"
										onClick={discardRecording}
										disabled={recordingState === "saving"}
									>
										Discard
									</Button>
								</div>
								{/* Preview */}
								{/* biome-ignore lint/a11y/useMediaCaption: recording preview */}
								<audio src={audioUrl} controls className="w-full" />
								<div className="flex items-center gap-1">
									<Play className="size-3.5 text-muted-foreground" />
									<p className="text-muted-foreground text-xs">
										Listen back before saving
									</p>
								</div>
							</div>
						)}
				</div>

				{/* Save */}
				{(recordingState === "stopped" || recordingState === "saving") && (
					<Button
						className="w-full gap-2"
						onClick={saveRecording}
						disabled={!isFormComplete || recordingState === "saving"}
					>
						{recordingState === "saving" ? (
							<>
								<Loader2 className="size-4 animate-spin" />
								Saving…
							</>
						) : (
							<>
								<Check className="size-4" />
								Save Recording
							</>
						)}
					</Button>
				)}
			</div>
		</div>
	);
}
