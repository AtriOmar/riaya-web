"use client";

import {
	Bot,
	CheckCircle2,
	ChevronDown,
	ChevronUp,
	Clock,
	Loader2,
	Mic,
	Plus,
	RefreshCw,
	XCircle,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getErrorMessage } from "@/lib/error-handling";
import type { GetApiRecordings200Item } from "@/services/generated/api.schemas";
import {
	useGetApiRecordings,
	usePostApiRecordingsIdTranscribe,
} from "@/services/generated/recordings/recordings";

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string | null | undefined }) {
	if (!status || status === "pending") {
		return (
			<Badge variant="outline" className="gap-1 text-muted-foreground">
				<Clock className="size-3" />
				No transcript
			</Badge>
		);
	}
	if (status === "processing") {
		return (
			<Badge
				variant="outline"
				className="gap-1 border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-300"
			>
				<Loader2 className="size-3 animate-spin" />
				Transcribing…
			</Badge>
		);
	}
	if (status === "done") {
		return (
			<Badge
				variant="outline"
				className="gap-1 border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
			>
				<CheckCircle2 className="size-3" />
				Transcribed
			</Badge>
		);
	}
	if (status === "error") {
		return (
			<Badge
				variant="outline"
				className="gap-1 border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300"
			>
				<XCircle className="size-3" />
				Failed
			</Badge>
		);
	}
	return null;
}

// ─── Recording card ───────────────────────────────────────────────────────────

function RecordingCard({
	recording,
	onTranscribed,
}: {
	recording: GetApiRecordings200Item;
	onTranscribed: () => void;
}) {
	const [transcriptExpanded, setTranscriptExpanded] = useState(false);
	const { trigger: transcribe, isMutating: isTranscribing } =
		usePostApiRecordingsIdTranscribe(recording.id.toString());

	const canTranscribe =
		recording.transcriptStatus === "pending" ||
		recording.transcriptStatus === "error";

	const handleTranscribe = async (e: React.MouseEvent) => {
		e.stopPropagation();
		try {
			await transcribe();
			toast.success("Transcript generated");
			onTranscribed();
		} catch (err) {
			toast.error(getErrorMessage(err, "Transcription failed"));
		}
	};

	return (
		<div className="rounded-xl border bg-card p-4 space-y-3">
			<div className="flex items-start justify-between gap-3">
				<div className="flex items-start gap-3 min-w-0">
					<div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 mt-0.5">
						<Mic className="size-4 text-primary" />
					</div>
					<div className="min-w-0">
						<Link
							href={`/dashboard/recordings?id=${recording.id}`}
							className="truncate font-medium hover:underline"
						>
							{recording.title ?? "Untitled"}
						</Link>
						<div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground text-xs">
							{recording.durationSeconds && (
								<span className="flex items-center gap-1">
									<Clock className="size-3" />
									{Math.floor(recording.durationSeconds / 60)}m{" "}
									{recording.durationSeconds % 60}s
								</span>
							)}
							{recording.createdAt && (
								<span>
									{new Date(recording.createdAt).toLocaleDateString("en-GB")}
								</span>
							)}
						</div>
					</div>
				</div>

				<div className="flex shrink-0 flex-wrap items-center gap-2">
					<StatusBadge status={recording.transcriptStatus} />
					{recording.transcriptStatus === "done" && (
						<Button
							size="sm"
							variant="outline"
							className="gap-1.5 h-7 px-2 text-xs"
							asChild
						>
							<Link href={`/dashboard/ai-chat?transcript=${recording.id}`}>
								<Bot className="size-3" />
								Chat
							</Link>
						</Button>
					)}
					{canTranscribe && (
						<Button
							type="button"
							variant="outline"
							size="sm"
							className="gap-1.5 h-7 px-2 text-xs"
							onClick={handleTranscribe}
							disabled={isTranscribing}
						>
							{isTranscribing ? (
								<Loader2 className="size-3 animate-spin" />
							) : (
								<RefreshCw className="size-3" />
							)}
							Transcribe
						</Button>
					)}
				</div>
			</div>

			{/* Audio player */}
			{/* biome-ignore lint/a11y/useMediaCaption: doctor-recorded audio */}
			<audio src={recording.audioUrl} controls className="w-full h-8" />

			{/* Transcript preview */}
			{recording.transcriptStatus === "done" &&
				Boolean(recording.transcript) && (
					<div className="space-y-2">
						<button
							type="button"
							className="flex items-center gap-1 text-muted-foreground text-xs hover:text-foreground"
							onClick={() => setTranscriptExpanded((v) => !v)}
						>
							{transcriptExpanded ? (
								<ChevronUp className="size-3" />
							) : (
								<ChevronDown className="size-3" />
							)}
							{transcriptExpanded ? "Hide transcript" : "Show transcript"}
						</button>
						{transcriptExpanded && (
							<div className="rounded-lg bg-muted/50 p-3">
								<p className="whitespace-pre-wrap text-sm leading-relaxed">
									{typeof recording.transcript === "string"
										? recording.transcript
										: (recording.transcript as any)?.segments
											? (recording.transcript as any).segments
													.map(
														(s: any) => `${s.speaker || "Speaker"}: ${s.text}`,
													)
													.join("\n")
											: JSON.stringify(recording.transcript, null, 2)}
								</p>
							</div>
						)}
					</div>
				)}
		</div>
	);
}

// ─── Patient recordings list ──────────────────────────────────────────────────

export function PatientRecordingsList({ patientId }: { patientId: number }) {
	const {
		data: recordings,
		isLoading,
		mutate,
	} = useGetApiRecordings({ patientId });

	return (
		<div className="space-y-4 lg:col-span-2">
			<div className="flex items-center justify-between">
				<h4 className="font-semibold text-lg">Recordings</h4>
				<Button asChild size="sm" variant="outline" className="gap-1.5">
					<Link href="/dashboard/recordings?new=1">
						<Plus className="size-3.5" />
						New
					</Link>
				</Button>
			</div>

			{isLoading && (
				<div className="flex items-center gap-2 text-muted-foreground text-sm">
					<Loader2 className="size-4 animate-spin" />
					Loading recordings…
				</div>
			)}

			{!isLoading && (!recordings || recordings.length === 0) && (
				<div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed bg-muted/30 py-8 text-center">
					<div className="flex size-10 items-center justify-center rounded-full bg-muted">
						<Mic className="size-5 text-muted-foreground" />
					</div>
					<p className="text-muted-foreground text-sm">
						No recordings for this patient yet.
					</p>
				</div>
			)}

			{!isLoading && recordings && recordings.length > 0 && (
				<div className="space-y-3">
					{recordings.map((rec) => (
						<RecordingCard
							key={rec.id}
							recording={rec}
							onTranscribed={() => mutate()}
						/>
					))}
				</div>
			)}
		</div>
	);
}
