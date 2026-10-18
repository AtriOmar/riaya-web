"use client";

import { format } from "date-fns";
import { Ban, Loader2, RotateCcw, X } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { formatDurationSeconds } from "@/components/admin/calls/call-helpers";
import CallTranscript from "@/components/admin/calls/call-transcript";
import { AudioWaveformPlayer } from "@/components/ui/audio-waveform-player";
import { Button } from "@/components/ui/button";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import {
	dbEventToTimeline,
	type TimelineEntry,
} from "@/hooks/use-realtime-socket";
import { getErrorMessage } from "@/lib/error-handling";
import { formatPhoneDisplay } from "@/lib/phone";
import { cn } from "@/lib/utils";
import {
	useGetApiCallReportsId,
	usePatchApiCallReportsId,
} from "@/services/generated/abuse/abuse";
import BlockNumberDialog from "./block-number-dialog";
import {
	CATEGORY_LABELS,
	formatBlockExpiry,
	ordinal,
	revalidateAbuseData,
} from "./report-labels";

export function CategoryBadge({ category }: { category: string }) {
	const meta = CATEGORY_LABELS[category] ?? CATEGORY_LABELS.other;
	return (
		<span
			className={cn(
				"shrink-0 rounded-full px-2 py-0.5 font-medium text-xs",
				meta.className,
			)}
		>
			{meta.label}
		</span>
	);
}

type Props = {
	reportId: number | null;
	onOpenChange: (open: boolean) => void;
};

export default function ReportSheet({ reportId, onOpenChange }: Props) {
	return (
		<Sheet open={reportId !== null} onOpenChange={onOpenChange}>
			<SheetContent
				side="right"
				showCloseButton
				className="gap-0 p-0 !w-[min(100vw,600px)] !max-w-[min(100vw,600px)]"
			>
				<SheetTitle className="sr-only">Reported call</SheetTitle>
				<SheetDescription className="sr-only">
					Recording, transcript and actions for a call the AI reported.
				</SheetDescription>
				{reportId !== null && (
					<ReportDetail
						reportId={reportId}
						onDone={() => onOpenChange(false)}
					/>
				)}
			</SheetContent>
		</Sheet>
	);
}

function ReportDetail({
	reportId,
	onDone,
}: {
	reportId: number;
	onDone: () => void;
}) {
	const id = String(reportId);
	const { data: report, isLoading } = useGetApiCallReportsId(id);
	const { trigger: patchReport, isMutating } = usePatchApiCallReportsId(id);
	const [blockOpen, setBlockOpen] = useState(false);

	const timeline = useMemo(
		() =>
			(report?.call.events ?? [])
				.map(dbEventToTimeline)
				.filter((e): e is TimelineEntry => e !== null),
		[report],
	);

	if (isLoading || !report) {
		return (
			<div className="flex flex-col gap-3 p-4 pt-12">
				<Skeleton className="h-6 w-48" />
				<Skeleton className="h-4 w-64" />
				<Skeleton className="h-20 w-full" />
				<Skeleton className="h-64 w-full" />
			</div>
		);
	}

	async function updateStatus(action: "dismiss" | "reopen") {
		try {
			await patchReport({ action });
			await revalidateAbuseData();
			toast.success(
				action === "dismiss" ? "Report dismissed" : "Report reopened",
			);
			if (action === "dismiss") onDone();
		} catch (e) {
			toast.error(getErrorMessage(e));
		}
	}

	const { number, block } = report;
	const isOpen = report.status === "open";
	const reportedAt = format(new Date(report.createdAt), "d MMM yyyy · HH:mm");

	return (
		<div className="flex h-full min-h-0 flex-col">
			<div className="shrink-0 border-b px-4 py-3 pr-12">
				<div className="flex flex-wrap items-center gap-2">
					<span className="font-semibold text-base">
						{formatPhoneDisplay(report.phoneNumber)}
					</span>
					<CategoryBadge category={report.category} />
					{block && (
						<span className="rounded-full bg-destructive/10 px-2 py-0.5 font-medium text-destructive text-xs">
							Blocked · {formatBlockExpiry(block.expiresAt)}
						</span>
					)}
				</div>
				<p className="mt-1 text-muted-foreground text-sm">
					{reportedAt}
					{report.call.duration != null &&
						` · ${formatDurationSeconds(report.call.duration)}`}
					{" · "}
					{ordinal(number.reportCount)} report · {number.callCount}{" "}
					{number.callCount === 1 ? "call" : "calls"} from this number
				</p>
			</div>

			<div className="shrink-0 border-b bg-muted/30 px-4 py-3">
				<div className="mb-1 font-medium text-muted-foreground text-xs uppercase tracking-wide">
					Why the AI reported it
				</div>
				<p className="text-sm leading-relaxed">{report.summary}</p>
			</div>

			<div className="shrink-0 border-b px-4 py-2.5">
				<div className="mb-2 font-medium text-muted-foreground text-xs uppercase tracking-wide">
					Recording
				</div>
				{report.call.recordingUrl ? (
					<AudioWaveformPlayer
						src={report.call.recordingUrl}
						waveformSrc={`/api/calls/${report.call.id}/recording`}
					/>
				) : (
					<p className="text-muted-foreground text-sm">
						No recording for this call. Read the transcript below.
					</p>
				)}
			</div>

			<div className="flex min-h-0 flex-1 flex-col overflow-hidden">
				<CallTranscript
					timeline={timeline}
					isActive={false}
					variant="drawer"
					scrollAreaClassName="min-h-0 flex-1"
				/>
				{report.otherReports.length > 0 && (
					<div className="shrink-0 border-t px-4 py-3">
						<div className="mb-2 font-medium text-muted-foreground text-xs uppercase tracking-wide">
							Other reports for this number
						</div>
						<ul className="grid gap-1.5">
							{report.otherReports.map((r) => (
								<li key={r.id} className="flex items-center gap-2 text-sm">
									<CategoryBadge category={r.category} />
									<span className="truncate">{r.summary}</span>
									<span className="ml-auto shrink-0 text-muted-foreground text-xs">
										{format(new Date(r.createdAt), "d MMM")}
									</span>
								</li>
							))}
						</ul>
					</div>
				)}
			</div>

			<div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t px-4 py-3">
				{isOpen ? (
					<>
						<Button
							variant="outline"
							disabled={isMutating}
							onClick={() => updateStatus("dismiss")}
						>
							{isMutating ? <Loader2 className="animate-spin" /> : <X />}
							Dismiss
						</Button>
						{!block && (
							<Button variant="destructive" onClick={() => setBlockOpen(true)}>
								<Ban />
								Block number
							</Button>
						)}
					</>
				) : (
					<>
						<span className="mr-auto text-muted-foreground text-sm">
							{report.status === "blocked" ? "Number blocked" : "Dismissed"}
							{report.reviewedAt &&
								` on ${format(new Date(report.reviewedAt), "d MMM yyyy")}`}
						</span>
						{report.status === "dismissed" && (
							<Button
								variant="outline"
								disabled={isMutating}
								onClick={() => updateStatus("reopen")}
							>
								<RotateCcw />
								Reopen
							</Button>
						)}
					</>
				)}
			</div>

			<BlockNumberDialog
				open={blockOpen}
				onOpenChange={setBlockOpen}
				phoneNumber={report.phoneNumber}
				reportId={report.id}
				defaultReason={report.summary}
				defaultDuration={number.reportCount > 1 ? "permanent" : "7d"}
				onBlocked={onDone}
			/>
		</div>
	);
}
