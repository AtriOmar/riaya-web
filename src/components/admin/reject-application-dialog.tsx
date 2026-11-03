"use client";

import { Plus, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Worded for the applicant: these lines are shown to the doctor as-is.
const REJECTION_REASONS = [
	"The ID card (CIN) photos are unreadable or incomplete",
	"The ID card (CIN) does not match the name on the application",
	"The medical council number could not be verified",
	"The medical council certificate is missing or invalid",
	"The selected speciality does not match the documents provided",
	"The cabinet name or location is incorrect or incomplete",
	"The application contains incomplete or inconsistent information",
];

const MAX_NOTE_LENGTH = 300;
const MAX_NOTES = 5;

type Props = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	saving: boolean;
	onConfirm: (reasons: string[]) => void;
};

export default function RejectApplicationDialog({
	open,
	onOpenChange,
	saving,
	onConfirm,
}: Props) {
	const [selected, setSelected] = useState<string[]>([]);
	const [notes, setNotes] = useState<string[]>([]);

	// Start fresh each time the dialog opens.
	useEffect(() => {
		if (!open) return;
		setSelected([]);
		setNotes([]);
	}, [open]);

	const reasons = [...selected, ...notes.map((n) => n.trim()).filter(Boolean)];

	function toggle(reason: string, checked: boolean) {
		setSelected((prev) =>
			checked ? [...prev, reason] : prev.filter((r) => r !== reason),
		);
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>Reject Application</DialogTitle>
					<DialogDescription>
						The doctor will see the reasons you pick so they know what to fix.
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-2">
					{REJECTION_REASONS.map((reason) => (
						<Label
							key={reason}
							className="flex items-start gap-3 hover:bg-muted/50 p-2.5 border rounded-md font-normal text-sm leading-snug cursor-pointer"
						>
							<Checkbox
								className="mt-0.5"
								checked={selected.includes(reason)}
								onCheckedChange={(checked) => toggle(reason, checked === true)}
							/>
							{reason}
						</Label>
					))}
				</div>

				<div className="space-y-2">
					<Label>Additional notes (optional)</Label>
					{notes.map((note, i) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: notes are edited in place and have no stable id
						<div key={i} className="flex gap-2">
							<Input
								value={note}
								onChange={(e) =>
									setNotes((prev) =>
										prev.map((n, j) => (j === i ? e.target.value : n)),
									)
								}
								maxLength={MAX_NOTE_LENGTH}
								placeholder="Anything else the doctor should know…"
								autoFocus
							/>
							<Button
								variant="ghost"
								size="icon"
								aria-label="Remove note"
								onClick={() =>
									setNotes((prev) => prev.filter((_, j) => j !== i))
								}
							>
								<X />
							</Button>
						</div>
					))}
					{notes.length < MAX_NOTES && (
						<Button
							variant="outline"
							size="sm"
							onClick={() => setNotes((prev) => [...prev, ""])}
						>
							<Plus />
							Add a note
						</Button>
					)}
				</div>

				<DialogFooter>
					<Button variant="outline" onClick={() => onOpenChange(false)}>
						Cancel
					</Button>
					<Button
						variant="destructive"
						onClick={() => onConfirm(reasons)}
						disabled={saving || reasons.length === 0}
					>
						Reject Application
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
