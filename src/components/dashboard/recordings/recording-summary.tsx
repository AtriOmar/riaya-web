"use client";

import { Loader2, Lock, Pencil, RefreshCw, Sparkles } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
	CONSULTATION_SUMMARY_SECTIONS,
	type ConsultationSummary,
} from "@/lib/consultation-summary";
import { getErrorMessage } from "@/lib/error-handling";
import { useGetApiBillingSubscription } from "@/services/generated/billing/billing";
import {
	usePatchApiRecordingsId,
	usePostApiRecordingsIdSummary,
} from "@/services/generated/recordings/recordings";

type SummaryRecording = {
	id: number;
	transcriptStatus: string;
	summary: ConsultationSummary | null;
	summaryStatus: string | null;
};

/**
 * The AI consultation note for a recording (Pro): written automatically after
 * transcription, editable, and regenerable. Free doctors see what they'd get.
 */
export function RecordingSummary({
	recording,
	onChanged,
}: {
	recording: SummaryRecording;
	onChanged: () => void;
}) {
	const { data: billing } = useGetApiBillingSubscription();
	const { trigger: summarize, isMutating: isSummarizing } =
		usePostApiRecordingsIdSummary(String(recording.id));
	const { trigger: update, isMutating: isSaving } = usePatchApiRecordingsId(
		String(recording.id),
	);
	const [draft, setDraft] = useState<ConsultationSummary | null>(null);

	// Nothing to summarize until there's a transcript
	if (recording.transcriptStatus !== "done" || !billing) return null;

	if (!billing.plan.canSummarizeRecordings) {
		return (
			<div className="flex items-center gap-3 rounded-lg border border-dashed px-3 py-2.5">
				<Lock className="size-4 shrink-0 text-muted-foreground" />
				<p className="flex-1 text-muted-foreground text-sm">
					Get an automatic consultation note from every recording.
				</p>
				<Button asChild size="sm" variant="outline">
					<Link href="/dashboard/subscription">Upgrade to Pro</Link>
				</Button>
			</div>
		);
	}

	async function regenerate() {
		try {
			await summarize();
			onChanged();
		} catch (err) {
			toast.error(getErrorMessage(err, "Couldn't write the summary."));
		}
	}

	async function save() {
		if (!draft) return;
		try {
			await update({ summary: draft });
			setDraft(null);
			onChanged();
		} catch (err) {
			toast.error(getErrorMessage(err, "Couldn't save the summary."));
		}
	}

	if (recording.summaryStatus === "processing" || isSummarizing) {
		return (
			<div className="flex items-center gap-2 py-2 text-muted-foreground text-sm">
				<Loader2 className="size-4 animate-spin" />
				Writing the consultation note…
			</div>
		);
	}

	if (!recording.summary) {
		return (
			<div className="flex flex-wrap items-center gap-3">
				{recording.summaryStatus === "error" && (
					<p className="text-red-600 text-sm dark:text-red-400">
						The summary couldn't be written.
					</p>
				)}
				<Button
					size="sm"
					variant="outline"
					className="gap-1.5"
					onClick={regenerate}
				>
					<Sparkles className="size-3.5" />
					{recording.summaryStatus === "error" ? "Try again" : "Summarize"}
				</Button>
			</div>
		);
	}

	if (draft) {
		return (
			<div className="space-y-3">
				{CONSULTATION_SUMMARY_SECTIONS.map(({ key, label }) => (
					<div key={key}>
						<p className="mb-1 font-medium text-muted-foreground text-xs">
							{label}
						</p>
						<Textarea
							value={draft[key]}
							rows={2}
							onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
						/>
					</div>
				))}
				<div className="flex gap-2">
					<Button size="sm" onClick={save} disabled={isSaving}>
						{isSaving && <Loader2 className="size-4 animate-spin" />}
						Save
					</Button>
					<Button size="sm" variant="ghost" onClick={() => setDraft(null)}>
						Cancel
					</Button>
				</div>
			</div>
		);
	}

	const filled = CONSULTATION_SUMMARY_SECTIONS.filter(({ key }) =>
		recording.summary?.[key]?.trim(),
	);

	return (
		<div className="space-y-2">
			<div className="flex items-center justify-between gap-2">
				<p className="flex items-center gap-1.5 font-medium text-sm">
					<Sparkles className="size-3.5 text-primary" />
					Consultation note
				</p>
				<div className="flex gap-0.5">
					<Button
						size="icon-sm"
						variant="ghost"
						className="text-muted-foreground"
						aria-label="Edit note"
						title="Edit note"
						onClick={() => recording.summary && setDraft(recording.summary)}
					>
						<Pencil className="size-3.5" />
					</Button>
					<Button
						size="icon-sm"
						variant="ghost"
						className="text-muted-foreground"
						aria-label="Rewrite note from the transcript"
						title="Rewrite from the transcript (replaces your edits)"
						onClick={regenerate}
					>
						<RefreshCw className="size-3.5" />
					</Button>
				</div>
			</div>
			{filled.length === 0 ? (
				<p className="text-muted-foreground text-sm">
					Nothing clinical was discussed in this recording.
				</p>
			) : (
				<dl className="space-y-2 rounded-lg bg-muted/50 p-3">
					{filled.map(({ key, label }) => (
						<div key={key}>
							<dt className="font-medium text-muted-foreground text-xs">
								{label}
							</dt>
							<dd className="whitespace-pre-wrap text-sm leading-relaxed">
								{recording.summary?.[key]}
							</dd>
						</div>
					))}
				</dl>
			)}
		</div>
	);
}
