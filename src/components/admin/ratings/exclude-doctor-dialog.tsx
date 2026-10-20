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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getErrorMessage } from "@/lib/error-handling";
import { usePostApiDoctorsIdBestFitExclusion } from "@/services/generated/ratings/ratings";
import { revalidateRatingsData } from "./rating-labels";

type Props = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	doctorId: number;
	doctorName: string;
};

export default function ExcludeDoctorDialog({
	open,
	onOpenChange,
	doctorId,
	doctorName,
}: Props) {
	const [reason, setReason] = useState("");
	const { trigger, isMutating } = usePostApiDoctorsIdBestFitExclusion(
		String(doctorId),
	);

	useEffect(() => {
		if (open) setReason("");
	}, [open]);

	async function submit() {
		try {
			await trigger({ reason: reason.trim() });
			toast.success(`Dr ${doctorName} no longer receives referrals`);
			await revalidateRatingsData();
			onOpenChange(false);
		} catch (e) {
			toast.error(getErrorMessage(e));
		}
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Stop referrals to Dr {doctorName}?</DialogTitle>
					<DialogDescription>
						The AI stops suggesting this doctor to callers, including emergency
						requests. Patients who ask for them by name can still book. You can
						list them again at any time.
					</DialogDescription>
				</DialogHeader>

				<div className="grid gap-2">
					<Label htmlFor="exclude-reason">Reason</Label>
					<Textarea
						id="exclude-reason"
						value={reason}
						onChange={(e) => setReason(e.target.value)}
						placeholder="e.g. Several patients reported very long waits."
						rows={4}
					/>
					<p className="rounded-md bg-yellow-500/10 px-3 py-2 text-sm text-yellow-800 dark:text-yellow-200">
						The doctor will see this reason on their dashboard, word for word,
						with a note to contact support at contact@riaya.tn. Don't quote
						patients or include anything that identifies them.
					</p>
				</div>

				<DialogFooter>
					<DialogClose asChild>
						<Button variant="outline">Cancel</Button>
					</DialogClose>
					<Button
						variant="destructive"
						disabled={!reason.trim() || isMutating}
						onClick={submit}
					>
						Stop referrals
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
