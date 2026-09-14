"use client";

import {
	CheckCircle2,
	Clock,
	Loader2,
	Mic,
	Plus,
	RefreshCw,
	User,
	XCircle,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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

function TranscriptStatusBadge({
	status,
}: {
	status: string | null | undefined;
}) {
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

// ─── Recording row ────────────────────────────────────────────────────────────

function RecordingRow({
	recording,
	onTranscribed,
}: {
	recording: GetApiRecordings200Item;
	onTranscribed: () => void;
}) {
	const router = useRouter();
	const { trigger: transcribe, isMutating: isTranscribing } =
		usePostApiRecordingsIdTranscribe(recording.id.toString());

	const patientName =
		recording.patient?.firstName || recording.patient?.lastName
			? `${recording.patient.firstName ?? ""} ${recording.patient.lastName ?? ""}`.trim()
			: null;

	const canTranscribe =
		recording.transcriptStatus === "pending" ||
		recording.transcriptStatus === "error";

	const handleTranscribe = async (e: React.MouseEvent) => {
		e.stopPropagation();
		try {
			await transcribe();
			toast.success("Transcript generated successfully");
			onTranscribed();
		} catch (err) {
			toast.error(getErrorMessage(err, "Failed to generate transcript"));
		}
	};

	return (
		<button
			type="button"
			className="flex w-full cursor-pointer items-start justify-between gap-4 rounded-xl border bg-card p-4 text-left transition-colors hover:bg-accent/40"
			onClick={() => router.push(`/dashboard/recordings/${recording.id}`)}
			aria-label={`Open recording: ${recording.title}`}
		>
			<div className="flex min-w-0 flex-1 items-start gap-3">
				<div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
					<Mic className="size-4 text-primary" />
				</div>
				<div className="min-w-0">
					<p className="truncate font-medium">
						{recording.title ?? "Untitled"}
					</p>
					<div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground text-xs">
						{patientName && (
							<span className="flex items-center gap-1">
								<User className="size-3" />
								{patientName}
							</span>
						)}
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

			<div className="flex shrink-0 items-center gap-2">
				<TranscriptStatusBadge status={recording.transcriptStatus} />
				{canTranscribe && (
					<Button
						type="button"
						variant="outline"
						size="sm"
						className="gap-1.5"
						onClick={handleTranscribe}
						disabled={isTranscribing}
					>
						{isTranscribing ? (
							<Loader2 className="size-3.5 animate-spin" />
						) : (
							<RefreshCw className="size-3.5" />
						)}
						{isTranscribing ? "Transcribing…" : "Transcribe"}
					</Button>
				)}
			</div>
		</button>
	);
}

// ─── Main list ────────────────────────────────────────────────────────────────

export default function RecordingsList() {
	const { data: recordings, isLoading, mutate } = useGetApiRecordings();

	return (
		<div>
			<div className="mb-6 flex items-center justify-between">
				<p className="text-muted-foreground text-sm">
					{recordings?.length
						? `${recordings.length} recording${recordings.length !== 1 ? "s" : ""}`
						: ""}
				</p>
				<Button asChild className="md:-mt-12">
					<Link href="/dashboard/recordings/new">
						<Plus className="size-4" />
						New Recording
					</Link>
				</Button>
			</div>

			{isLoading && (
				<div className="flex justify-center py-16">
					<Loader2 className="size-8 animate-spin text-muted-foreground" />
				</div>
			)}

			{!isLoading && (!recordings || recordings.length === 0) && (
				<div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed bg-muted/30 py-16 text-center">
					<div className="flex size-14 items-center justify-center rounded-full bg-muted">
						<Mic className="size-7 text-muted-foreground" />
					</div>
					<div>
						<p className="font-medium">No recordings yet</p>
						<p className="text-muted-foreground text-sm">
							Record a patient conversation and get an AI transcript
						</p>
					</div>
					<Button asChild>
						<Link href="/dashboard/recordings/new">
							<Plus className="size-4" />
							New Recording
						</Link>
					</Button>
				</div>
			)}

			{!isLoading && recordings && recordings.length > 0 && (
				<div className="space-y-3">
					{recordings.map((recording) => (
						<RecordingRow
							key={recording.id}
							recording={recording}
							onTranscribed={() => mutate()}
						/>
					))}
				</div>
			)}
		</div>
	);
}
