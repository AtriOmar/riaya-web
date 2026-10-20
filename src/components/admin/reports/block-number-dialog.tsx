"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { FilterSegmented } from "@/components/ui/filter-controls";
import { Label } from "@/components/ui/label";
import { PhoneNumberInput } from "@/components/ui/phone-input";
import { Textarea } from "@/components/ui/textarea";
import { getErrorMessage } from "@/lib/error-handling";
import {
	formatPhoneDisplay,
	isValidPhoneNumber,
	normalizePhoneForStorage,
} from "@/lib/phone";
import { usePostApiBlockedPhones } from "@/services/generated/abuse/abuse";
import type { PostApiBlockedPhonesBodyDuration } from "@/services/generated/api.schemas";
import { DURATION_OPTIONS, revalidateAbuseData } from "./report-labels";

type Props = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** Fixed number (blocking from a report). Leave out to let the admin type one. */
	phoneNumber?: string;
	reportId?: number;
	defaultReason?: string;
	defaultDuration?: PostApiBlockedPhonesBodyDuration;
	onBlocked?: () => void;
};

export default function BlockNumberDialog({
	open,
	onOpenChange,
	phoneNumber,
	reportId,
	defaultReason = "",
	defaultDuration = "permanent",
	onBlocked,
}: Props) {
	const [phone, setPhone] = useState("");
	const [duration, setDuration] = useState(defaultDuration);
	const [reason, setReason] = useState(defaultReason);
	const { trigger, isMutating } = usePostApiBlockedPhones();

	// Start fresh each time the dialog opens.
	useEffect(() => {
		if (!open) return;
		setPhone("");
		setDuration(defaultDuration);
		setReason(defaultReason);
	}, [open, defaultDuration, defaultReason]);

	const target = phoneNumber ?? phone;
	const canSubmit = phoneNumber ? true : isValidPhoneNumber(phone);

	async function submit() {
		const normalized = normalizePhoneForStorage(target);
		if (!normalized) return;
		try {
			await trigger({
				phoneNumber: normalized,
				duration,
				reason: reason.trim() || null,
				reportId: reportId ?? null,
			});
			toast.success(`${formatPhoneDisplay(normalized)} blocked`);
			await revalidateAbuseData();
			onOpenChange(false);
			onBlocked?.();
		} catch (e) {
			toast.error(getErrorMessage(e));
		}
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>
						{phoneNumber
							? `Block ${formatPhoneDisplay(phoneNumber)}?`
							: "Block a number"}
					</DialogTitle>
					<DialogDescription>
						Calls from this number are rejected before the AI answers. You can
						unblock it at any time.
					</DialogDescription>
				</DialogHeader>

				<div className="grid gap-4">
					{!phoneNumber && (
						<div className="grid gap-2">
							<Label htmlFor="block-phone">Phone number</Label>
							<PhoneNumberInput
								id="block-phone"
								value={phone}
								onChange={setPhone}
							/>
						</div>
					)}
					<div className="grid gap-2">
						<Label>Block for</Label>
						<FilterSegmented
							value={duration}
							onChange={setDuration}
							options={DURATION_OPTIONS}
							className="w-fit"
						/>
					</div>
					<div className="grid gap-2">
						<Label htmlFor="block-reason">
							Note <span className="text-muted-foreground">(optional)</span>
						</Label>
						<Textarea
							id="block-reason"
							value={reason}
							onChange={(e) => setReason(e.target.value)}
							placeholder="Why is this number blocked?"
							rows={3}
						/>
					</div>
				</div>

				<DialogFooter>
					<DialogClose asChild>
						<Button variant="outline">Cancel</Button>
					</DialogClose>
					<Button
						variant="destructive"
						disabled={!canSubmit || isMutating}
						onClick={submit}
					>
						Block number
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
