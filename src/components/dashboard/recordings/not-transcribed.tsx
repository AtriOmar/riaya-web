"use client";

import { Loader2, RefreshCw } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getErrorMessage } from "@/lib/error-handling";
import { formatRecordingTime } from "@/lib/recording-time";
import { useGetApiBillingSubscription } from "@/services/generated/billing/billing";
import { usePostApiRecordingsIdTranscribe } from "@/services/generated/recordings/recordings";

/**
 * A recording saved while no recording time was left. Transcribing it is a
 * deliberate click once time is available, never automatic.
 */
export function NotTranscribed({
	recordingId,
	durationSeconds,
	onTranscribed,
}: {
	recordingId: number;
	durationSeconds: number | null;
	onTranscribed: () => void;
}) {
	const { data: billing, mutate: refreshBilling } =
		useGetApiBillingSubscription();
	const { trigger: transcribe, isMutating } = usePostApiRecordingsIdTranscribe(
		String(recordingId),
	);

	if (!billing) return null;
	const hasTime = billing.plan.recordingTime.remainingSeconds > 0;
	const uses =
		durationSeconds != null && durationSeconds > 0
			? ` · uses ${formatRecordingTime(Math.max(60, durationSeconds))}`
			: "";

	async function run() {
		try {
			await transcribe();
			toast.success("Transcript ready");
			void refreshBilling();
			onTranscribed();
		} catch (err) {
			toast.error(getErrorMessage(err, "Transcription failed"));
		}
	}

	return (
		<div className="flex flex-col items-start gap-2 rounded-lg border border-dashed px-3 py-2.5">
			<p className="text-muted-foreground text-sm">
				{hasTime
					? "Saved without a transcript."
					: "Saved without a transcript: no recording time was left."}
			</p>
			{hasTime ? (
				<Button
					size="sm"
					className="gap-1.5"
					onClick={run}
					disabled={isMutating}
				>
					{isMutating ? (
						<Loader2 className="size-3.5 animate-spin" />
					) : (
						<RefreshCw className="size-3.5" />
					)}
					Transcribe{uses}
				</Button>
			) : (
				<Button asChild size="sm" variant="outline">
					<Link
						href={
							billing.plan.canBuyRecordingPacks
								? "/dashboard/subscription?addHours=1"
								: "/dashboard/subscription"
						}
					>
						{billing.plan.canBuyRecordingPacks
							? "Add recording hours"
							: "Upgrade to Pro"}
					</Link>
				</Button>
			)}
		</div>
	);
}
