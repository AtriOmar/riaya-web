"use client";

import { AlertTriangle, Loader2, Trash2, Upload } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getApiErrorCode, getErrorMessage } from "@/lib/error-handling";
import {
	clearRecordingDraft,
	isRecordingDraftActive,
	loadRecordingDraft,
	loadRecordingDraftAudio,
	type RecordingDraft,
} from "@/lib/recording-draft";
import { uploadBlobToR2 } from "@/lib/upload";
import { usePostApiRecordings } from "@/services/generated/recordings/recordings";

function formatStarted(iso: string) {
	const d = new Date(iso);
	return Number.isNaN(d.getTime())
		? "earlier"
		: d.toLocaleString("en-GB", {
				day: "numeric",
				month: "short",
				hour: "2-digit",
				minute: "2-digit",
			});
}

/**
 * Offers to save a recording the page closed on before it was saved (tab
 * closed, refresh, crash). Its audio was kept in this browser while recording.
 */
export function UnsavedRecordingBanner({
	onSaved,
}: {
	onSaved: (recordingId: number) => void;
}) {
	const [draft, setDraft] = useState<RecordingDraft | null>(null);
	const [busy, setBusy] = useState<"save" | "discard" | null>(null);
	const { trigger: createRecording } = usePostApiRecordings();

	useEffect(() => {
		void loadRecordingDraft().then((d) => {
			// A recording in progress on this page isn't "unsaved"
			if (!isRecordingDraftActive()) setDraft(d);
		});
	}, []);

	if (!draft) return null;

	async function save(current: RecordingDraft) {
		setBusy("save");
		try {
			const blob = await loadRecordingDraftAudio(current);
			const audioUrl = await uploadBlobToR2(
				blob,
				`recording-${Date.now()}.wav`,
				"recordings",
			);
			const body = {
				audioUrl,
				title: current.title.trim() || undefined,
				durationSeconds: current.durationSeconds || undefined,
				patientId: current.patientId ?? undefined,
			};
			const recording = await createRecording(body).catch((err) => {
				// The patient may have been deleted since: keep the recording anyway
				if (getApiErrorCode(err) === "PATIENT_NOT_FOUND") {
					return createRecording({ ...body, patientId: undefined });
				}
				throw err;
			});
			await clearRecordingDraft();
			setDraft(null);
			toast.success("Recording saved");
			onSaved(recording.id);
		} catch (err) {
			toast.error(getErrorMessage(err, "Couldn't save the recording."));
		} finally {
			setBusy(null);
		}
	}

	async function discard() {
		setBusy("discard");
		await clearRecordingDraft();
		setDraft(null);
		setBusy(null);
	}

	const minutes = Math.max(1, Math.round(draft.durationSeconds / 60));

	return (
		<div className="mb-4 flex flex-col gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 sm:flex-row sm:items-center">
			<AlertTriangle className="size-5 shrink-0 text-amber-600 dark:text-amber-400" />
			<div className="min-w-0 flex-1">
				<p className="font-medium text-sm">
					A recording from {formatStarted(draft.startedAt)} wasn't saved
				</p>
				<p className="text-muted-foreground text-xs">
					About {minutes} min. The page closed before it was saved, but the
					audio was kept on this device.
				</p>
			</div>
			<div className="flex gap-2">
				<Button
					size="sm"
					className="gap-1.5"
					onClick={() => save(draft)}
					disabled={busy != null}
				>
					{busy === "save" ? (
						<Loader2 className="size-3.5 animate-spin" />
					) : (
						<Upload className="size-3.5" />
					)}
					Save it
				</Button>
				<Button
					size="sm"
					variant="ghost"
					className="gap-1.5 text-muted-foreground hover:text-destructive"
					onClick={discard}
					disabled={busy != null}
				>
					<Trash2 className="size-3.5" />
					Discard
				</Button>
			</div>
		</div>
	);
}
