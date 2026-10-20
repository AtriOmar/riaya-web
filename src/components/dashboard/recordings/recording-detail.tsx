/** biome-ignore-all lint/suspicious/noArrayIndexKey: explanation */
/** biome-ignore-all lint/suspicious/noExplicitAny: explanation */
"use client";

import {
	Bot,
	Check,
	Clock,
	Loader2,
	Mic,
	Pencil,
	RefreshCw,
	User,
	X,
	XCircle,
} from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { AudioWaveformPlayer } from "@/components/ui/audio-waveform-player";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { getErrorMessage } from "@/lib/error-handling";
import { recordingTitle } from "@/lib/recording-title";
import { speakerName, transcriptSpeakers } from "@/lib/transcript";
import { transcriptRefreshInterval } from "@/lib/transcript-polling";
import { cn } from "@/lib/utils";
import type { GetApiPatients200Item } from "@/services/generated/api.schemas";
import { useGetApiPatients } from "@/services/generated/patients/patients";
import {
	useGetApiRecordingsId,
	usePatchApiRecordingsId,
	usePostApiRecordingsIdTranscribe,
} from "@/services/generated/recordings/recordings";
import { DeleteRecordingButton } from "./delete-recording-button";
import { NotTranscribed } from "./not-transcribed";
import { RecordingSummary } from "./recording-summary";
import { SpeakerRolesEditor } from "./speaker-roles-editor";

// ─── Patient picker (reused from new-recording) ───────────────────────────────

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
					className="justify-between w-full"
				>
					<span className="flex items-center gap-2">
						<User className="size-4 text-muted-foreground" />
						{selected
							? `${selected.firstName ?? ""} ${selected.lastName ?? ""}`.trim() ||
								"(unnamed)"
							: "Select patient"}
					</span>
				</Button>
			</PopoverTrigger>
			<PopoverContent className="p-0 w-72" align="start">
				<div className="p-2 border-b">
					<Input
						placeholder="Search by name or CIN…"
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						className="shadow-none border-0 focus-visible:ring-0 h-8"
					/>
				</div>
				<div className="py-1 max-h-56 overflow-y-auto">
					{selected && (
						<button
							type="button"
							className="flex items-center gap-2 hover:bg-accent px-3 py-2 w-full text-muted-foreground text-sm"
							onClick={() => {
								onSelect(null);
								setOpen(false);
							}}
						>
							Remove patient link
						</button>
					)}
					{filtered.length === 0 && (
						<p className="px-3 py-4 text-muted-foreground text-sm text-center">
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
								className="flex items-center gap-2 hover:bg-accent px-3 py-2 w-full text-sm"
								onClick={() => {
									onSelect(p);
									setOpen(false);
									setSearch("");
								}}
							>
								{selected?.id === p.id && (
									<Check className="size-4 text-primary shrink-0" />
								)}
								<span className="flex-1 ml-auto text-left">{name}</span>
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

// ─── Recording detail ─────────────────────────────────────────────────────────

function formatTimestamp(seconds: number) {
	return `${Math.floor(seconds / 60)}:${Math.floor(seconds % 60)
		.toString()
		.padStart(2, "0")}`;
}

export default function RecordingDetail({
	recordingId,
	onClose,
	onDeleted,
}: {
	recordingId: number;
	/** Shows a close button in the header. */
	onClose?: () => void;
	/** Called after the recording is deleted (e.g. to close the panel). */
	onDeleted: () => void;
}) {
	const {
		data: recording,
		isLoading,
		mutate,
	} = useGetApiRecordingsId(recordingId.toString(), {
		swr: { refreshInterval: transcriptRefreshInterval },
	});
	const { data: patients = [] } = useGetApiPatients();

	const { trigger: updateRecording, isMutating: isUpdating } =
		usePatchApiRecordingsId(recordingId.toString());
	const { trigger: transcribe, isMutating: isTranscribing } =
		usePostApiRecordingsIdTranscribe(recordingId.toString());

	const audioRef = useRef<HTMLAudioElement>(null);
	const [isEditingTitle, setIsEditingTitle] = useState(false);
	const [titleDraft, setTitleDraft] = useState("");
	const [isEditingPatient, setIsEditingPatient] = useState(false);
	const [patientDraft, setPatientDraft] =
		useState<GetApiPatients200Item | null>(null);

	const closeButton = onClose && (
		<Button
			variant="ghost"
			size="icon-sm"
			className="shrink-0 text-muted-foreground"
			aria-label="Close recording"
			onClick={onClose}
		>
			<X className="size-4" />
		</Button>
	);

	if (isLoading) {
		return (
			<div className="flex justify-center py-16">
				<Loader2 className="size-8 text-muted-foreground animate-spin" />
			</div>
		);
	}

	if (!recording) {
		return (
			<div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
				<XCircle className="size-10 text-muted-foreground" />
				<p className="text-muted-foreground">Recording not found.</p>
				{onClose && (
					<Button variant="outline" onClick={onClose}>
						Close
					</Button>
				)}
			</div>
		);
	}

	const patientName =
		recording.patient?.firstName || recording.patient?.lastName
			? `${recording.patient.firstName ?? ""} ${recording.patient.lastName ?? ""}`.trim()
			: null;

	const status = recording.transcriptStatus;

	const handleTranscribe = async () => {
		try {
			await transcribe();
			toast.success("Transcript generated");
			mutate();
		} catch (err) {
			toast.error(getErrorMessage(err, "Transcription failed"));
		}
	};

	const saveTitle = async () => {
		if (!titleDraft.trim()) return;
		try {
			await updateRecording({ title: titleDraft.trim() });
			toast.success("Title updated");
			setIsEditingTitle(false);
			mutate();
		} catch (err) {
			toast.error(getErrorMessage(err, "Failed to update title"));
		}
	};

	const savePatient = async () => {
		try {
			await updateRecording({ patientId: patientDraft?.id ?? null });
			toast.success(patientDraft ? "Patient assigned" : "Patient link removed");
			setIsEditingPatient(false);
			mutate();
		} catch (err) {
			toast.error(getErrorMessage(err, "Failed to update patient"));
		}
	};

	const seekTo = (seconds: number) => {
		const audio = audioRef.current;
		if (!audio) return;
		audio.currentTime = seconds;
		void audio.play();
	};

	const transcript = recording.transcript as any;
	const segments: any[] | null =
		transcript &&
		typeof transcript === "object" &&
		Array.isArray(transcript.segments)
			? transcript.segments
			: null;

	return (
		<div className="flex flex-col">
			{/* Header */}
			<div className="top-0 z-10 sticky flex items-start gap-3 bg-card px-6 pt-5 pb-4 border-b">
				<div className="flex-1 min-w-0">
					{isEditingTitle ? (
						<div className="flex gap-2">
							<Input
								value={titleDraft}
								onChange={(e) => setTitleDraft(e.target.value)}
								className="font-medium"
								autoFocus
								onKeyDown={(e) => {
									if (e.key === "Enter") saveTitle();
									if (e.key === "Escape") setIsEditingTitle(false);
								}}
							/>
							<Button
								size="icon"
								onClick={saveTitle}
								disabled={isUpdating}
								aria-label="Save title"
							>
								{isUpdating ? (
									<Loader2 className="size-4 animate-spin" />
								) : (
									<Check className="size-4" />
								)}
							</Button>
						</div>
					) : (
						<button
							type="button"
							className="group flex items-center gap-2 max-w-full text-left"
							onClick={() => {
								setTitleDraft(recording.title ?? "");
								setIsEditingTitle(true);
							}}
							aria-label="Edit title"
						>
							<h2 className="font-semibold text-lg truncate">
								{recordingTitle(recording)}
							</h2>
							<Pencil className="size-3.5 text-muted-foreground group-hover:text-foreground shrink-0" />
						</button>
					)}
					<div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-muted-foreground text-sm">
						{recording.createdAt && (
							<span className="flex items-center gap-1.5">
								<Clock className="size-3.5" />
								{new Date(recording.createdAt).toLocaleDateString("en-GB", {
									year: "numeric",
									month: "long",
									day: "numeric",
								})}
							</span>
						)}
						{recording.durationSeconds != null && (
							<span className="flex items-center gap-1.5">
								<Mic className="size-3.5" />
								{Math.floor(recording.durationSeconds / 60)}m{" "}
								{recording.durationSeconds % 60}s
							</span>
						)}
					</div>
				</div>
				{isEditingTitle ? (
					<Button
						variant="ghost"
						size="icon-sm"
						className="-mr-2 text-muted-foreground"
						aria-label="Cancel editing title"
						onClick={() => setIsEditingTitle(false)}
					>
						<X className="size-4" />
					</Button>
				) : (
					<div className="-mr-2 flex shrink-0 items-center">
						<DeleteRecordingButton
							recordingId={recording.id}
							onDeleted={onDeleted}
						/>
						{closeButton}
					</div>
				)}
			</div>

			<div className="space-y-8 px-6 pt-5 pb-8">
				{/* Patient */}
				<section className="space-y-2">
					<h3 className="font-medium text-muted-foreground text-xs uppercase tracking-wider">
						Patient
					</h3>
					{isEditingPatient ? (
						<div className="space-y-2">
							<PatientCombobox
								patients={patients}
								selected={patientDraft}
								onSelect={setPatientDraft}
							/>
							<div className="flex gap-2">
								<Button size="sm" onClick={savePatient} disabled={isUpdating}>
									{isUpdating && <Loader2 className="size-4 animate-spin" />}
									Save
								</Button>
								<Button
									size="sm"
									variant="ghost"
									onClick={() => setIsEditingPatient(false)}
								>
									Cancel
								</Button>
							</div>
						</div>
					) : (
						<div className="flex justify-between items-center gap-3">
							<div className="flex items-center gap-2.5 min-w-0">
								<div className="flex justify-center items-center bg-primary/10 rounded-full size-8 shrink-0">
									<User className="size-4 text-primary" />
								</div>
								{patientName ? (
									<Link
										href={`/dashboard/patients/${recording.patientId}`}
										className="font-medium text-sm hover:underline truncate"
									>
										{patientName}
									</Link>
								) : (
									<span className="text-muted-foreground text-sm">
										No patient assigned
									</span>
								)}
							</div>
							<Button
								variant="ghost"
								size="sm"
								className="text-muted-foreground"
								onClick={() => {
									const currentPatient =
										patients.find((p) => p.id === recording.patientId) ?? null;
									setPatientDraft(currentPatient);
									setIsEditingPatient(true);
								}}
							>
								{patientName ? "Change" : "Assign"}
							</Button>
						</div>
					)}
				</section>

				{/* Audio */}
				<section className="space-y-2">
					<h3 className="font-medium text-muted-foreground text-xs uppercase tracking-wider">
						Audio
					</h3>
					<AudioWaveformPlayer src={recording.audioUrl} audioRef={audioRef} />
				</section>

				{/* Consultation note (Pro) */}
				{status === "done" && (
					<section>
						<RecordingSummary
							recording={recording}
							onChanged={() => mutate()}
						/>
					</section>
				)}

				{/* Transcript */}
				<section className="space-y-3">
					<div className="flex justify-between items-center gap-2">
						<h3 className="font-medium text-muted-foreground text-xs uppercase tracking-wider">
							Transcript
						</h3>
						{status === "done" && (
							<div className="flex items-center gap-1">
								<Button
									variant="ghost"
									size="icon-sm"
									className="text-muted-foreground"
									onClick={handleTranscribe}
									disabled={isTranscribing}
									aria-label="Regenerate transcript"
									title="Regenerate transcript"
								>
									<RefreshCw
										className={cn("size-3.5", isTranscribing && "animate-spin")}
									/>
								</Button>
								<Button size="sm" className="gap-1.5" asChild>
									<Link href={`/dashboard/ai-chat?transcript=${recordingId}`}>
										<Bot className="size-3.5" />
										Discuss with AI
									</Link>
								</Button>
							</div>
						)}
					</div>

					{(status === "processing" || isTranscribing) && (
						<div className="flex items-center gap-3 py-6 text-muted-foreground text-sm">
							<Loader2 className="size-4 animate-spin" />
							Transcribing the conversation. This updates on its own.
						</div>
					)}

					{status === "skipped" && !isTranscribing && (
						<NotTranscribed
							recordingId={recording.id}
							durationSeconds={recording.durationSeconds}
							onTranscribed={() => mutate()}
						/>
					)}

					{!isTranscribing &&
						(status === "pending" || status === "error" || !status) && (
							<div className="flex flex-col items-start gap-3 py-2">
								<p
									className={cn(
										"text-sm",
										status === "error"
											? "text-red-600 dark:text-red-400"
											: "text-muted-foreground",
									)}
								>
									{status === "error"
										? "Transcription failed."
										: "No transcript yet."}
								</p>
								<Button
									size="sm"
									className="gap-1.5"
									onClick={handleTranscribe}
								>
									<RefreshCw className="size-3.5" />
									{status === "error" ? "Try again" : "Generate transcript"}
								</Button>
							</div>
						)}

					{status === "done" &&
						!isTranscribing &&
						Boolean(transcript) &&
						(segments ? (
							<div className="space-y-3">
								<SpeakerRolesEditor
									recordingId={recording.id}
									speakers={transcriptSpeakers(transcript)}
									speakerRoles={recording.speakerRoles}
									onChanged={() => mutate()}
								/>
								<div className="-mx-2">
									{segments.map((segment: any, idx: number) => (
										<button
											key={idx}
											type="button"
											onClick={() => seekTo(segment.start)}
											className="flex gap-4 hover:bg-muted/60 px-2 py-2.5 rounded-md w-full text-left transition-colors cursor-pointer"
										>
											<span className="mt-0.5 w-9 font-mono tabular-nums text-primary text-xs shrink-0">
												{formatTimestamp(segment.start)}
											</span>
											<div className="min-w-0">
												<span className="font-semibold text-muted-foreground text-xs uppercase tracking-wider">
													{speakerName(segment.speaker, recording.speakerRoles)}
												</span>
												{/* Each line picks its own direction: Arabic/Derja RTL, French LTR */}
												<p
													dir="auto"
													className="mt-0.5 text-start text-sm leading-relaxed [unicode-bidi:plaintext]"
												>
													{segment.text ||
														segment.words?.map((w: any) => w.word).join(" ")}
												</p>
											</div>
										</button>
									))}
								</div>
							</div>
						) : (
							<p
								dir="auto"
								className="text-sm leading-relaxed whitespace-pre-wrap [unicode-bidi:plaintext]"
							>
								{typeof transcript === "string"
									? transcript
									: JSON.stringify(transcript, null, 2)}
							</p>
						))}
				</section>
			</div>
		</div>
	);
}
