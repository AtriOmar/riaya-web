"use client";

import { Check, Pencil, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getErrorMessage } from "@/lib/error-handling";
import { cn } from "@/lib/utils";

type Props = {
	value: string | null | undefined;
	/** Saves the new address; throws when it fails. */
	onSave: (address: string) => Promise<void>;
	/** `box` is the profile page look, `plain` the admin card look. */
	variant?: "box" | "plain";
};

/** The cabinet's written address with an inline edit. Patients are told this text. */
export default function CabinetAddressField({
	value,
	onSave,
	variant = "box",
}: Props) {
	const [editing, setEditing] = useState(false);
	const [draft, setDraft] = useState("");
	const [saving, setSaving] = useState(false);

	function startEditing() {
		setDraft(value ?? "");
		setEditing(true);
	}

	async function save() {
		const next = draft.trim();
		if (!next) return;
		if (next === value) {
			setEditing(false);
			return;
		}
		setSaving(true);
		try {
			await onSave(next);
			setEditing(false);
			toast.success("Cabinet address saved");
		} catch (err) {
			toast.error(getErrorMessage(err));
		} finally {
			setSaving(false);
		}
	}

	const label = (
		<p
			className={cn(
				"text-muted-foreground",
				variant === "box" ? "font-medium text-sm" : "text-xs",
			)}
		>
			Cabinet Address
		</p>
	);

	if (editing) {
		return (
			<div className="min-w-0">
				{label}
				<form
					className="flex items-center gap-2 mt-1"
					onSubmit={(e) => {
						e.preventDefault();
						void save();
					}}
				>
					<Input
						autoFocus
						value={draft}
						maxLength={500}
						onChange={(e) => setDraft(e.target.value)}
						aria-label="Cabinet address"
						disabled={saving}
					/>
					<Button
						type="submit"
						size="icon"
						disabled={saving || !draft.trim()}
						aria-label="Save address"
					>
						<Check className="size-4" />
					</Button>
					<Button
						type="button"
						size="icon"
						variant="outline"
						onClick={() => setEditing(false)}
						disabled={saving}
						aria-label="Cancel"
					>
						<X className="size-4" />
					</Button>
				</form>
			</div>
		);
	}

	return (
		<div className="min-w-0">
			{label}
			<div
				className={cn(
					"flex items-center justify-between gap-2",
					variant === "box"
						? "mt-1 px-3 py-1.5 rounded-sm border border-border/50 bg-muted font-medium text-sm"
						: "mt-0.5 font-medium text-sm",
				)}
			>
				<span className="truncate">{value || "—"}</span>
				<button
					type="button"
					onClick={startEditing}
					className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
					aria-label="Edit cabinet address"
				>
					<Pencil className="size-3.5" />
				</button>
			</div>
		</div>
	);
}
