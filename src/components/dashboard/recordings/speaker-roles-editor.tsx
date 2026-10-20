"use client";

import { Check, ChevronDown, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { getErrorMessage } from "@/lib/error-handling";
import {
	SPEAKER_ROLE_LABELS,
	SPEAKER_ROLES,
	type SpeakerRole,
	type SpeakerRoles,
} from "@/lib/speaker-roles";
import { cn } from "@/lib/utils";
import { usePatchApiRecordingsId } from "@/services/generated/recordings/recordings";

function SpeakerChip({
	label,
	role,
	saving,
	onPick,
}: {
	label: string;
	role: SpeakerRole | undefined;
	saving: boolean;
	onPick: (role: SpeakerRole) => void;
}) {
	const [open, setOpen] = useState(false);
	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button
					variant="outline"
					size="sm"
					className="h-7 gap-1 px-2 text-xs"
					disabled={saving}
				>
					{role ? (
						<>
							<span className="font-medium">{SPEAKER_ROLE_LABELS[role]}</span>
							<span className="text-muted-foreground">· {label}</span>
						</>
					) : (
						<span>{label}</span>
					)}
					<ChevronDown className="size-3 text-muted-foreground" />
				</Button>
			</PopoverTrigger>
			<PopoverContent className="w-44 p-1" align="start">
				<p className="px-2 py-1.5 text-muted-foreground text-xs">
					Who is {label}?
				</p>
				{SPEAKER_ROLES.map((option) => (
					<button
						key={option}
						type="button"
						className={cn(
							"flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent",
						)}
						onClick={() => {
							setOpen(false);
							if (option !== role) onPick(option);
						}}
					>
						<Check
							className={cn("size-3.5", option === role ? "" : "invisible")}
						/>
						{SPEAKER_ROLE_LABELS[option]}
					</button>
				))}
			</PopoverContent>
		</Popover>
	);
}

/**
 * Who each transcript speaker is (set by the AI). The doctor can correct a
 * role; it changes that speaker's name across the whole transcript.
 */
export function SpeakerRolesEditor({
	recordingId,
	speakers,
	speakerRoles,
	onChanged,
}: {
	recordingId: number;
	/** Speaker labels in the transcript ("Speaker 1"…) */
	speakers: string[];
	speakerRoles: SpeakerRoles | null;
	onChanged: () => void;
}) {
	const { trigger, isMutating } = usePatchApiRecordingsId(String(recordingId));

	if (speakers.length === 0) return null;

	async function pick(label: string, role: SpeakerRole) {
		try {
			await trigger({
				speakerRoles: { ...(speakerRoles ?? {}), [label]: role },
			});
			onChanged();
		} catch (err) {
			toast.error(getErrorMessage(err, "Couldn't change the speaker."));
		}
	}

	return (
		<div className="flex flex-wrap items-center gap-1.5">
			<span className="text-muted-foreground text-xs">Speakers</span>
			{speakers.map((label) => (
				<SpeakerChip
					key={label}
					label={label}
					role={speakerRoles?.[label]}
					saving={isMutating}
					onPick={(role) => pick(label, role)}
				/>
			))}
			{isMutating && (
				<Loader2 className="size-3.5 animate-spin text-muted-foreground" />
			)}
		</div>
	);
}
