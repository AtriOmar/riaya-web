"use client";

import {
	Bot,
	ChevronDown,
	ChevronUp,
	Clock,
	FileText,
	Loader2,
	Mic,
	Plus,
	RefreshCw,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { DeleteRecordingButton } from "@/components/dashboard/recordings/delete-recording-button";
import { NotTranscribed } from "@/components/dashboard/recordings/not-transcribed";
import { RecordingSummary } from "@/components/dashboard/recordings/recording-summary";
import { AudioWaveformPlayer } from "@/components/ui/audio-waveform-player";
import { Button } from "@/components/ui/button";
import { getErrorMessage } from "@/lib/error-handling";
import { recordingTitle } from "@/lib/recording-title";
import type { SpeakerRoles } from "@/lib/speaker-roles";
import {
	parseTranscriptPayload,
	segmentText,
	speakerName,
} from "@/lib/transcript";
import { transcriptRefreshInterval } from "@/lib/transcript-polling";
import type {
	GetApiPatientsId200MedicalFilesItem,
	GetApiRecordings200Item,
} from "@/services/generated/api.schemas";
import {
	useGetApiRecordings,
	usePostApiRecordingsIdTranscribe,
} from "@/services/generated/recordings/recordings";
import { MedicalFileCard } from "./medical-file-card";

type HistoryEntry =
	| { kind: "file"; date: number; file: GetApiPatientsId200MedicalFilesItem }
	| { kind: "recording"; date: number; recording: GetApiRecordings200Item };

function timeOf(value: string | null | undefined): number {
	const t = value ? new Date(value).getTime() : Number.NaN;
	return Number.isNaN(t) ? 0 : t;
}

function formatDuration(seconds: number) {
	return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

function TranscriptText({
	transcript,
	speakerRoles,
}: {
	transcript: unknown;
	speakerRoles: SpeakerRoles | null;
}) {
	const parsed = parseTranscriptPayload(transcript);
	if (!parsed) return null;
	return (
		<div className="max-h-80 space-y-2 overflow-y-auto rounded-lg bg-muted/50 p-3">
			{parsed.kind === "segments" ? (
				parsed.segments.map((s, i) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: segments have no stable id
					<div key={i}>
						<p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
							{speakerName(s.speaker, speakerRoles)}
						</p>
						{/* Each line picks its own direction: Arabic/Derja RTL, French LTR */}
						<p
							dir="auto"
							className="text-sm leading-relaxed [unicode-bidi:plaintext]"
						>
							{segmentText(s)}
						</p>
					</div>
				))
			) : (
				<p
					dir="auto"
					className="whitespace-pre-wrap text-sm leading-relaxed [unicode-bidi:plaintext]"
				>
					{parsed.text}
				</p>
			)}
		</div>
	);
}

/** A recorded consultation in the patient's history. */
function RecordingEntry({
	recording,
	onChanged,
}: {
	recording: GetApiRecordings200Item;
	onChanged: () => void;
}) {
	const [showTranscript, setShowTranscript] = useState(false);
	const { trigger: transcribe, isMutating: isTranscribing } =
		usePostApiRecordingsIdTranscribe(String(recording.id));
	const status = recording.transcriptStatus;

	async function retry() {
		try {
			await transcribe();
			onChanged();
		} catch (err) {
			toast.error(getErrorMessage(err, "Transcription failed"));
		}
	}

	return (
		<div className="space-y-3 rounded-xl border bg-card p-4">
			<div className="flex items-start gap-3">
				<div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
					<Mic className="size-4 text-primary" />
				</div>
				<div className="min-w-0 flex-1">
					<Link
						href={`/dashboard/recordings?id=${recording.id}`}
						className="font-medium hover:underline"
					>
						{recordingTitle(recording)}
					</Link>
					<div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-muted-foreground text-xs">
						<span>Consultation recording</span>
						{recording.createdAt && (
							<span>
								{new Date(recording.createdAt).toLocaleDateString("en-GB")}
							</span>
						)}
						{recording.durationSeconds != null && (
							<span className="flex items-center gap-1">
								<Clock className="size-3" />
								{formatDuration(recording.durationSeconds)}
							</span>
						)}
					</div>
				</div>
				<div className="flex shrink-0 items-center gap-1">
					{status === "done" && (
						<Button size="sm" variant="outline" className="gap-1.5" asChild>
							<Link href={`/dashboard/ai-chat?transcript=${recording.id}`}>
								<Bot className="size-3.5" />
								<span className="hidden sm:inline">Discuss with AI</span>
							</Link>
						</Button>
					)}
					<DeleteRecordingButton
						recordingId={recording.id}
						onDeleted={onChanged}
					/>
				</div>
			</div>

			<AudioWaveformPlayer src={recording.audioUrl} />

			{status === "processing" && (
				<p className="flex items-center gap-2 text-muted-foreground text-sm">
					<Loader2 className="size-4 animate-spin" />
					Transcribing. This updates on its own.
				</p>
			)}

			{status === "skipped" && (
				<NotTranscribed
					recordingId={recording.id}
					durationSeconds={recording.durationSeconds}
					onTranscribed={onChanged}
				/>
			)}

			{(status === "error" || status === "pending") && (
				<div className="flex flex-wrap items-center gap-3">
					<p className="text-muted-foreground text-sm">
						{status === "error"
							? "Transcription failed."
							: "No transcript yet."}
					</p>
					<Button
						size="sm"
						variant="outline"
						className="gap-1.5"
						onClick={retry}
						disabled={isTranscribing}
					>
						{isTranscribing ? (
							<Loader2 className="size-3.5 animate-spin" />
						) : (
							<RefreshCw className="size-3.5" />
						)}
						{status === "error" ? "Try again" : "Transcribe"}
					</Button>
				</div>
			)}

			<RecordingSummary recording={recording} onChanged={onChanged} />

			{status === "done" && Boolean(recording.transcript) && (
				<div className="space-y-2">
					<button
						type="button"
						className="flex items-center gap-1 text-muted-foreground text-xs hover:text-foreground"
						onClick={() => setShowTranscript((v) => !v)}
					>
						{showTranscript ? (
							<ChevronUp className="size-3" />
						) : (
							<ChevronDown className="size-3" />
						)}
						{showTranscript ? "Hide transcript" : "Show transcript"}
					</button>
					{showTranscript && (
						<TranscriptText
							transcript={recording.transcript}
							speakerRoles={recording.speakerRoles}
						/>
					)}
				</div>
			)}
		</div>
	);
}

/**
 * The patient's history: medical files and recorded consultations in one
 * timeline, newest first.
 */
export function PatientHistory({
	patientId,
	medicalFiles,
	onChanged,
}: {
	patientId: number;
	medicalFiles: GetApiPatientsId200MedicalFilesItem[] | null | undefined;
	onChanged: () => void;
}) {
	const {
		data: recordings,
		isLoading,
		mutate: mutateRecordings,
	} = useGetApiRecordings(
		{ patientId },
		{ swr: { refreshInterval: transcriptRefreshInterval } },
	);

	const entries: HistoryEntry[] = [
		...(medicalFiles ?? []).map((file) => ({
			kind: "file" as const,
			date: timeOf(file.date ?? file.createdAt),
			file,
		})),
		...(recordings ?? []).map((recording) => ({
			kind: "recording" as const,
			date: timeOf(recording.createdAt),
			recording,
		})),
	].sort((a, b) => b.date - a.date);

	return (
		<div className="space-y-4 lg:col-span-2">
			<div className="flex items-center justify-between gap-2">
				<h4 className="font-semibold text-lg">History</h4>
				<Button asChild size="sm" variant="outline" className="gap-1.5">
					<Link href="/dashboard/recordings?new=1">
						<Plus className="size-3.5" />
						New recording
					</Link>
				</Button>
			</div>

			{isLoading && (
				<div className="flex items-center gap-2 text-muted-foreground text-sm">
					<Loader2 className="size-4 animate-spin" />
					Loading history…
				</div>
			)}

			{!isLoading && entries.length === 0 && (
				<div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed bg-muted/30 py-10 text-center">
					<div className="flex size-12 items-center justify-center rounded-full bg-muted">
						<FileText className="size-6 text-muted-foreground" aria-hidden />
					</div>
					<p className="text-muted-foreground text-sm">
						No history yet. Add a medical file or record a consultation.
					</p>
				</div>
			)}

			{!isLoading && entries.length > 0 && (
				<div className="space-y-3">
					{entries.map((entry) =>
						entry.kind === "file" ? (
							<MedicalFileCard
								key={`file-${entry.file.id}`}
								file={entry.file}
								patientId={patientId}
								onChanged={onChanged}
							/>
						) : (
							<RecordingEntry
								key={`recording-${entry.recording.id}`}
								recording={entry.recording}
								onChanged={() => mutateRecordings()}
							/>
						),
					)}
				</div>
			)}
		</div>
	);
}
