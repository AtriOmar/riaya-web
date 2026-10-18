"use client";

import { Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import ConfirmationDialog from "@/components/confirmation-dialog";
import { Button } from "@/components/ui/button";
import { getErrorMessage } from "@/lib/error-handling";
import { useDeleteApiRecordingsId } from "@/services/generated/recordings/recordings";

/** Trash button with a confirmation; deletes the recording and its audio. */
export function DeleteRecordingButton({
	recordingId,
	onDeleted,
}: {
	recordingId: number;
	onDeleted: () => void;
}) {
	const [open, setOpen] = useState(false);
	const { trigger, isMutating } = useDeleteApiRecordingsId(String(recordingId));

	async function confirm() {
		try {
			await trigger();
			toast.success("Recording deleted");
			setOpen(false);
			onDeleted();
		} catch (err) {
			toast.error(getErrorMessage(err, "Couldn't delete the recording."));
		}
	}

	return (
		<>
			<Button
				variant="ghost"
				size="icon-sm"
				className="shrink-0 text-muted-foreground hover:text-destructive"
				aria-label="Delete recording"
				title="Delete recording"
				onClick={() => setOpen(true)}
			>
				<Trash2 className="size-4" />
			</Button>
			<ConfirmationDialog
				open={open}
				onOpenChange={setOpen}
				title="Delete this recording?"
				description="The audio, transcript and consultation note are removed from the patient's history."
				variant="destructive"
				confirmText="Delete"
				onConfirm={confirm}
				isLoading={isMutating}
				alertTitle="This can't be undone"
				alertMessage="Recording time it already used isn't given back."
			/>
		</>
	);
}
