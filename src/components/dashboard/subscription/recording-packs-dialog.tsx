"use client";

import { Check, Clock, ExternalLink, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { getErrorMessage } from "@/lib/error-handling";
import {
	RECORDING_PACK_LIST,
	RECORDING_PACKS,
	type RecordingPackId,
} from "@/lib/plans";
import { formatRecordingTime } from "@/lib/recording-time";
import { cn } from "@/lib/utils";
import { usePostApiBillingRecordingPacks } from "@/services/generated/billing/billing";

/** Buy extra recording hours. Payment opens Konnect in a new tab. */
export function RecordingPacksDialog({
	open,
	onOpenChange,
	extraSeconds,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** Pack hours the doctor already has left */
	extraSeconds: number;
}) {
	const [packId, setPackId] = useState<RecordingPackId>(
		RECORDING_PACK_LIST[0].id,
	);
	const { trigger, isMutating } = usePostApiBillingRecordingPacks();

	async function buy() {
		try {
			const { payUrl } = await trigger({ packId });
			window.open(payUrl, "_blank", "noopener,noreferrer");
			toast.info(
				`Complete payment to add ${RECORDING_PACKS[packId].hours} hours.`,
			);
			onOpenChange(false);
		} catch (err) {
			toast.error(getErrorMessage(err, "Could not start payment."));
		}
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Add recording hours</DialogTitle>
					<DialogDescription>
						Used after your monthly hours run out. They never expire.
						{extraSeconds > 0 &&
							` You have ${formatRecordingTime(extraSeconds)} extra left.`}
					</DialogDescription>
				</DialogHeader>

				<div className="grid gap-2">
					{RECORDING_PACK_LIST.map((pack) => {
						const selected = pack.id === packId;
						return (
							<button
								key={pack.id}
								type="button"
								aria-pressed={selected}
								onClick={() => setPackId(pack.id)}
								className={cn(
									"flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors",
									"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
									selected
										? "border-primary bg-primary/5"
										: "hover:bg-muted/50",
								)}
							>
								<Clock className="size-4 shrink-0 text-muted-foreground" />
								<div className="flex-1">
									<p className="font-medium text-sm">{pack.hours} hours</p>
									<p className="text-muted-foreground text-xs">
										{(pack.priceTnd / pack.hours).toFixed(2)} TND / hour
									</p>
								</div>
								<span className="font-semibold tabular-nums">
									{pack.priceTnd} TND
								</span>
								<Check
									className={cn(
										"size-4 text-primary",
										!selected && "invisible",
									)}
								/>
							</button>
						);
					})}
				</div>

				<DialogFooter>
					<Button onClick={buy} disabled={isMutating} className="w-full gap-2">
						{isMutating ? (
							<Loader2 className="size-4 animate-spin" />
						) : (
							<ExternalLink className="size-4" />
						)}
						Pay {RECORDING_PACKS[packId].priceTnd} TND
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
