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
import { DeleteRecordingButton } from "@/components/dashboard/recordings/delete-recording-button";
import NewRecording from "@/components/dashboard/recordings/new-recording";
import RecordingDetail from "@/components/dashboard/recordings/recording-detail";
import { UnsavedRecordingBanner } from "@/components/dashboard/recordings/unsaved-recording-banner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useIsDesktop } from "@/hooks/use-is-desktop";
import { getErrorMessage } from "@/lib/error-handling";
import { recordingTitle } from "@/lib/recording-title";
import { transcriptRefreshInterval } from "@/lib/transcript-polling";
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
	if (status === "skipped") {
		return (
			<Badge variant="outline" className="gap-1 text-muted-foreground">
				<Clock className="size-3" />
				Not transcribed
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
	onDeleted,
}: {
	recording: GetApiRecordings200Item;
	selected: boolean;
	onSelect: () => void;
	onTranscribed: () => void;
	onDeleted: () => void;
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

	// The open button stretches over the whole card; actions sit above it
	// (buttons can't be nested inside a button).
	return (
		<div
			className={cn(
				"relative flex w-full items-start justify-between gap-4 rounded-xl border bg-card p-4 transition-colors hover:bg-accent/40 has-[[data-open]:focus-visible]:ring-2 has-[[data-open]:focus-visible]:ring-ring",
				selected && "border-primary/40 bg-accent/50 ring-1 ring-primary/20",
			)}
		>
			<button
				type="button"
				data-open
				className="flex min-w-0 flex-1 cursor-pointer items-start gap-3 text-left after:absolute after:inset-0 after:rounded-xl focus-visible:outline-none"
				onClick={onSelect}
				aria-label={`Open recording: ${recordingTitle(recording)}`}
				aria-pressed={selected}
			>
				<div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
					<Mic className="size-4 text-primary" />
				</div>
				<div className="min-w-0">
					<p className="truncate font-medium">{recordingTitle(recording)}</p>
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
			</button>

			<div className="relative z-10 flex shrink-0 items-center gap-2">
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
				<DeleteRecordingButton
					recordingId={recording.id}
					onDeleted={onDeleted}
				/>
			</div>
		</div>
	);
}

// ─── Main list + panel ────────────────────────────────────────────────────────

export default function RecordingsList() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const {
		data: recordings,
		isLoading,
		mutate,
	} = useGetApiRecordings(undefined, {
		swr: { refreshInterval: transcriptRefreshInterval },
	});

	// Right panel: always visible on desktop (defaults to a new recording),
	// a sheet on small screens that only opens when something is picked.
	const isDesktop = useIsDesktop();
	const [panel, setPanel] = useState<Panel>(null);
	const activePanel: Panel = panel ?? (isDesktop ? { type: "new" } : null);

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
			syncUrl(next);
		},
		[syncUrl],
	);

	const closePanel = useCallback(() => {
		setPanel(null);
		syncUrl(null);
	}, [syncUrl]);

	// Open from deep-link query on mount / when params change
	useEffect(() => {
		const idParam = searchParams.get("id");
		const isNew = searchParams.get("new") === "1";
		if (isNew) {
			setPanel({ type: "new" });
			return;
		}
		if (idParam) {
			const id = Number(idParam);
			if (!Number.isNaN(id)) setPanel({ type: "detail", id });
		}
	}, [searchParams]);

	const selectedId = activePanel?.type === "detail" ? activePanel.id : null;

	// The desktop panel always shows something, so only a recording can be
	// closed there (back to the new-recording form). The mobile sheet always can.
	const renderPanel = (current: NonNullable<Panel>) => {
		const onClose =
			!isDesktop || current.type === "detail" ? closePanel : undefined;
		return current.type === "new" ? (
			<NewRecording
				onClose={onClose}
				onSaved={(id) => {
					void mutate();
					openPanel({ type: "detail", id });
				}}
			/>
		) : (
			<RecordingDetail
				key={current.id}
				recordingId={current.id}
				onClose={onClose}
				onDeleted={() => {
					void mutate();
					closePanel();
				}}
			/>
		);
	};

	return (
		<div className="items-start gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,36rem)]">
			<div className="min-w-0">
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

				{/* Below the header row: its button is pulled up beside the page title */}
				<UnsavedRecordingBanner
					onSaved={(id) => {
						void mutate();
						openPanel({ type: "detail", id });
					}}
				/>

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
						<Button
							className="lg:hidden"
							onClick={() => openPanel({ type: "new" })}
						>
							<Plus className="size-4" />
							New Recording
						</Button>
					</div>
				)}

				{!isLoading && recordings && recordings.length > 0 && (
					<div className="flex flex-col gap-2">
						{recordings.map((recording) => (
							<RecordingRow
								key={recording.id}
								recording={recording}
								selected={selectedId === recording.id}
								onSelect={() => openPanel({ type: "detail", id: recording.id })}
								onTranscribed={() => mutate()}
								onDeleted={() => {
									void mutate();
									// Close the panel if it was showing this recording
									if (selectedId === recording.id) closePanel();
								}}
							/>
						))}
					</div>
				)}
			</div>

			{/* Desktop: permanent right panel */}
			{isDesktop && activePanel && (
				<aside className="top-20 sticky bg-card shadow-sm border rounded-xl max-h-[calc(100dvh-6rem)] overflow-y-auto">
					{renderPanel(activePanel)}
				</aside>
			)}

			{/* Small screens: panel as a sheet */}
			<Sheet
				modal={false}
				open={!isDesktop && Boolean(panel)}
				onOpenChange={(open) => {
					if (!open) closePanel();
				}}
			>
				<SheetContent
					side="right"
					showCloseButton={false}
					className="gap-0 bg-card p-0 border-l border-border !w-[min(100vw,600px)] !max-w-[min(100vw,600px)]"
					onPointerDownOutside={(e) => e.preventDefault()}
					onFocusOutside={(e) => e.preventDefault()}
				>
					<SheetTitle className="sr-only">
						{panel?.type === "new" ? "New recording" : "Recording details"}
					</SheetTitle>
					{panel ? (
						<div className="flex flex-col flex-1 min-h-0 overflow-y-auto">
							{renderPanel(panel)}
						</div>
					) : null}
				</SheetContent>
			</Sheet>
		</div>
	);
}
