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
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import NewRecording from "@/components/dashboard/recordings/new-recording";
import RecordingDetail from "@/components/dashboard/recordings/recording-detail";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { getErrorMessage } from "@/lib/error-handling";
import { cn } from "@/lib/utils";
import type { GetApiRecordings200Item } from "@/services/generated/api.schemas";
import {
	useGetApiRecordings,
	usePostApiRecordingsIdTranscribe,
} from "@/services/generated/recordings/recordings";

type Panel = { type: "detail"; id: number } | { type: "new" } | null;

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
	selected,
	onSelect,
	onTranscribed,
}: {
	recording: GetApiRecordings200Item;
	selected: boolean;
	onSelect: () => void;
	onTranscribed: () => void;
}) {
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
			className={cn(
				"flex w-full cursor-pointer items-start justify-between gap-4 rounded-xl border bg-card p-4 text-left transition-colors hover:bg-accent/40",
				selected && "border-primary/40 bg-accent/50 ring-1 ring-primary/20",
			)}
			onClick={onSelect}
			aria-label={`Open recording: ${recording.title}`}
			aria-pressed={selected}
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
						{recording.durationSeconds != null && (
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

// ─── Main list + panel ────────────────────────────────────────────────────────

export default function RecordingsList() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const { data: recordings, isLoading, mutate } = useGetApiRecordings();

	const [panel, setPanel] = useState<Panel>(null);
	const [detailsOpen, setDetailsOpen] = useState(false);

	const syncUrl = useCallback(
		(next: Panel) => {
			if (next?.type === "detail") {
				router.replace(`/dashboard/recordings?id=${next.id}`, {
					scroll: false,
				});
			} else if (next?.type === "new") {
				router.replace("/dashboard/recordings?new=1", { scroll: false });
			} else {
				router.replace("/dashboard/recordings", { scroll: false });
			}
		},
		[router],
	);

	const openPanel = useCallback(
		(next: Panel) => {
			setPanel(next);
			setDetailsOpen(Boolean(next));
			syncUrl(next);
		},
		[syncUrl],
	);

	const closePanel = useCallback(() => {
		setDetailsOpen(false);
		setPanel(null);
		syncUrl(null);
	}, [syncUrl]);

	// Open from deep-link query on mount / when params change
	useEffect(() => {
		const idParam = searchParams.get("id");
		const isNew = searchParams.get("new") === "1";
		if (isNew) {
			setPanel({ type: "new" });
			setDetailsOpen(true);
			return;
		}
		if (idParam) {
			const id = Number(idParam);
			if (!Number.isNaN(id)) {
				setPanel({ type: "detail", id });
				setDetailsOpen(true);
				return;
			}
		}
	}, [searchParams]);

	const selectedId = panel?.type === "detail" ? panel.id : null;

	return (
		<div>
			<div className="mb-2 flex items-center justify-between gap-4">
				<p className="text-muted-foreground text-sm">
					{recordings?.length
						? `${recordings.length} recording${recordings.length !== 1 ? "s" : ""}`
						: ""}
				</p>
				<Button
					className="md:-mt-12"
					onClick={() => openPanel({ type: "new" })}
				>
					<Plus className="size-4" />
					New Recording
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
					<Button onClick={() => openPanel({ type: "new" })}>
						<Plus className="size-4" />
						New Recording
					</Button>
				</div>
			)}

			{!isLoading && recordings && recordings.length > 0 && (
				<div className="w-full max-w-full lg:max-w-[500px]">
					<aside className="flex min-h-[min(72vh,640px)] flex-col gap-2 overflow-y-auto lg:min-h-[calc(100dvh-9rem)]">
						{recordings.map((recording) => (
							<RecordingRow
								key={recording.id}
								recording={recording}
								selected={selectedId === recording.id}
								onSelect={() => openPanel({ type: "detail", id: recording.id })}
								onTranscribed={() => mutate()}
							/>
						))}
					</aside>
				</div>
			)}

			<Sheet
				modal={false}
				open={detailsOpen && Boolean(panel)}
				onOpenChange={(open) => {
					if (!open) closePanel();
					else setDetailsOpen(true);
				}}
			>
				<SheetContent
					side="right"
					showCloseButton
					className="overflow-visible gap-0 border-l border-border p-0 !w-[min(100vw,600px)] !max-w-[min(100vw,600px)]"
					onPointerDownOutside={(e) => e.preventDefault()}
					onFocusOutside={(e) => e.preventDefault()}
				>
					<SheetTitle className="sr-only">
						{panel?.type === "new" ? "New recording" : "Recording details"}
					</SheetTitle>
					{panel ? (
						<div className="flex h-full min-h-0 flex-1 flex-col overflow-y-auto pt-12">
							{panel.type === "new" ? (
								<NewRecording
									onCancel={closePanel}
									onSaved={(id) => {
										void mutate();
										openPanel({ type: "detail", id });
									}}
								/>
							) : (
								<RecordingDetail
									key={panel.id}
									recordingId={panel.id}
									onClose={closePanel}
								/>
							)}
						</div>
					) : null}
				</SheetContent>
			</Sheet>
		</div>
	);
}
