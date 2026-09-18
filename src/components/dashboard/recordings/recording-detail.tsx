"use client";

import {
	Bot,
	Check,
	ChevronLeft,
	Clock,
	Loader2,
	Mic,
	Pencil,
	RefreshCw,
	User,
	X,
	XCircle,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { getErrorMessage } from "@/lib/error-handling";
import type { GetApiPatients200Item } from "@/services/generated/api.schemas";
import { useGetApiPatients } from "@/services/generated/patients/patients";
import {
	useGetApiRecordingsId,
	usePatchApiRecordingsId,
	usePostApiRecordingsIdTranscribe,
} from "@/services/generated/recordings/recordings";

// ─── Patient picker (reused from new-recording) ───────────────────────────────

function PatientCombobox({
	patients,
	selected,
	onSelect,
}: {
	patients: GetApiPatients200Item[];
	selected: GetApiPatients200Item | null;
	onSelect: (p: GetApiPatients200Item | null) => void;
}) {
	const [open, setOpen] = useState(false);
	const [search, setSearch] = useState("");

	const filtered = patients.filter((p) => {
		const name = `${p.firstName ?? ""} ${p.lastName ?? ""}`.toLowerCase();
		const cin = (p.cin ?? "").toLowerCase();
		return (
			name.includes(search.toLowerCase()) || cin.includes(search.toLowerCase())
		);
	});

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button
					variant="outline"
					role="combobox"
					aria-expanded={open}
					className="w-full justify-between"
				>
					<span className="flex items-center gap-2">
						<User className="size-4 text-muted-foreground" />
						{selected
							? `${selected.firstName ?? ""} ${selected.lastName ?? ""}`.trim() ||
								"(unnamed)"
							: "Select patient"}
					</span>
				</Button>
			</PopoverTrigger>
			<PopoverContent className="w-72 p-0" align="start">
				<div className="border-b p-2">
					<Input
						placeholder="Search by name or CIN…"
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						className="h-8 border-0 shadow-none focus-visible:ring-0"
					/>
				</div>
				<div className="max-h-56 overflow-y-auto py-1">
					{selected && (
						<button
							type="button"
							className="flex w-full items-center gap-2 px-3 py-2 text-muted-foreground text-sm hover:bg-accent"
							onClick={() => {
								onSelect(null);
								setOpen(false);
							}}
						>
							Remove patient link
						</button>
					)}
					{filtered.length === 0 && (
						<p className="px-3 py-4 text-center text-muted-foreground text-sm">
							No patients found
						</p>
					)}
					{filtered.map((p) => {
						const name =
							`${p.firstName ?? ""} ${p.lastName ?? ""}`.trim() || "(unnamed)";
						return (
							<button
								key={p.id}
								type="button"
								className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent"
								onClick={() => {
									onSelect(p);
									setOpen(false);
									setSearch("");
								}}
							>
								{selected?.id === p.id && (
									<Check className="size-4 shrink-0 text-primary" />
								)}
								<span className="ml-auto flex-1 text-left">{name}</span>
								{p.cin && (
									<span className="text-muted-foreground text-xs">{p.cin}</span>
								)}
							</button>
						);
					})}
				</div>
			</PopoverContent>
		</Popover>
	);
}

// ─── Recording detail ─────────────────────────────────────────────────────────

export default function RecordingDetail({
	recordingId,
	onClose,
}: {
	recordingId: number;
	/** When set (panel mode), replaces the back-to-list navigation. */
	onClose?: () => void;
}) {
	const router = useRouter();
	const {
		data: recording,
		isLoading,
		mutate,
	} = useGetApiRecordingsId(recordingId.toString());
	const { data: patients = [] } = useGetApiPatients();

	const { trigger: updateRecording, isMutating: isUpdating } =
		usePatchApiRecordingsId(recordingId.toString());
	const { trigger: transcribe, isMutating: isTranscribing } =
		usePostApiRecordingsIdTranscribe(recordingId.toString());

	const [isEditingTitle, setIsEditingTitle] = useState(false);
	const [titleDraft, setTitleDraft] = useState("");
	const [isEditingPatient, setIsEditingPatient] = useState(false);
	const [patientDraft, setPatientDraft] =
		useState<GetApiPatients200Item | null>(null);
	const [transcriptExpanded, setTranscriptExpanded] = useState(true);

	const goBack = () => {
		if (onClose) onClose();
		else router.push("/dashboard/recordings");
	};

	if (isLoading) {
		return (
			<div className="flex justify-center py-16">
				<Loader2 className="size-8 animate-spin text-muted-foreground" />
			</div>
		);
	}

	if (!recording) {
		return (
			<div className="flex flex-col items-center gap-3 py-16 text-center">
				<XCircle className="size-12 text-muted-foreground" />
				<p className="text-muted-foreground">Recording not found.</p>
				<Button variant="outline" onClick={goBack}>
					Back to recordings
				</Button>
			</div>
		);
	}

	const patientName =
		recording.patient?.firstName || recording.patient?.lastName
			? `${recording.patient.firstName ?? ""} ${recording.patient.lastName ?? ""}`.trim()
			: null;

	const canTranscribe =
		recording.transcriptStatus === "pending" ||
		recording.transcriptStatus === "error";

	const handleTranscribe = async () => {
		try {
			await transcribe();
			toast.success("Transcript generated");
			mutate();
		} catch (err) {
			toast.error(getErrorMessage(err, "Transcription failed"));
		}
	};

	const saveTitle = async () => {
		if (!titleDraft.trim()) return;
		try {
			await updateRecording({ title: titleDraft.trim() });
			toast.success("Title updated");
			setIsEditingTitle(false);
			mutate();
		} catch (err) {
			toast.error(getErrorMessage(err, "Failed to update title"));
		}
	};

	const savePatient = async () => {
		try {
			await updateRecording({ patientId: patientDraft?.id ?? null });
			toast.success(patientDraft ? "Patient assigned" : "Patient link removed");
			setIsEditingPatient(false);
			mutate();
		} catch (err) {
			toast.error(getErrorMessage(err, "Failed to update patient"));
		}
	};

	return (
		<div className="space-y-6 px-4 pb-6 sm:px-6">
			{!onClose && (
				<Button
					variant="ghost"
					className="-ml-2 gap-1.5 text-muted-foreground"
					onClick={goBack}
				>
					<ChevronLeft className="size-4" />
					Back to recordings
				</Button>
			)}

			{/* Header card */}
			<div className="space-y-4 rounded-xl border bg-card p-6">
				{/* Title */}
				<div>
					{isEditingTitle ? (
						<div className="flex gap-2">
							<Input
								value={titleDraft}
								onChange={(e) => setTitleDraft(e.target.value)}
								className="font-medium"
								autoFocus
								onKeyDown={(e) => {
									if (e.key === "Enter") saveTitle();
									if (e.key === "Escape") setIsEditingTitle(false);
								}}
							/>
							<Button size="sm" onClick={saveTitle} disabled={isUpdating}>
								{isUpdating ? (
									<Loader2 className="size-4 animate-spin" />
								) : (
									<Check className="size-4" />
								)}
							</Button>
							<Button
								size="sm"
								variant="ghost"
								onClick={() => setIsEditingTitle(false)}
							>
								<X className="size-4" />
							</Button>
						</div>
					) : (
						<div className="group flex items-start gap-2">
							<h2 className="font-semibold text-xl">
								{recording.title ?? "Untitled"}
							</h2>
							<button
								type="button"
								className="mt-1 opacity-0 transition-opacity group-hover:opacity-100"
								onClick={() => {
									setTitleDraft(recording.title ?? "");
									setIsEditingTitle(true);
								}}
								aria-label="Edit title"
							>
								<Pencil className="size-4 text-muted-foreground hover:text-foreground" />
							</button>
						</div>
					)}
				</div>

				{/* Meta */}
				<div className="flex flex-wrap gap-4 text-muted-foreground text-sm">
					{recording.createdAt && (
						<span className="flex items-center gap-1.5">
							<Clock className="size-4" />
							{new Date(recording.createdAt).toLocaleDateString("en-GB", {
								year: "numeric",
								month: "long",
								day: "numeric",
							})}
						</span>
					)}
					{recording.durationSeconds && (
						<span className="flex items-center gap-1.5">
							<Mic className="size-4" />
							{Math.floor(recording.durationSeconds / 60)}m{" "}
							{recording.durationSeconds % 60}s
						</span>
					)}
				</div>

				{/* Patient */}
				<div>
					{isEditingPatient ? (
						<div className="space-y-2">
							<Label className="text-xs">Assign patient</Label>
							<PatientCombobox
								patients={patients}
								selected={patientDraft}
								onSelect={setPatientDraft}
							/>
							<div className="flex gap-2">
								<Button size="sm" onClick={savePatient} disabled={isUpdating}>
									{isUpdating ? (
										<Loader2 className="size-4 animate-spin" />
									) : (
										"Save"
									)}
								</Button>
								<Button
									size="sm"
									variant="ghost"
									onClick={() => setIsEditingPatient(false)}
								>
									Cancel
								</Button>
							</div>
						</div>
					) : (
						<div className="flex items-center gap-2">
							<User className="size-4 text-muted-foreground" />
							{patientName ? (
								<Link
									href={`/dashboard/patients/${recording.patientId}`}
									className="text-primary text-sm hover:underline"
									onClick={(e) => e.stopPropagation()}
								>
									{patientName}
								</Link>
							) : (
								<span className="text-muted-foreground text-sm">
									No patient assigned
								</span>
							)}
							<button
								type="button"
								className="ml-1 text-muted-foreground hover:text-foreground"
								onClick={() => {
									const currentPatient =
										patients.find((p) => p.id === recording.patientId) ?? null;
									setPatientDraft(currentPatient);
									setIsEditingPatient(true);
								}}
								aria-label="Edit patient"
							>
								<Pencil className="size-3.5" />
							</button>
						</div>
					)}
				</div>
			</div>

			{/* Audio player */}
			<div className="rounded-xl border bg-card p-6 space-y-3">
				<h3 className="font-medium">Audio</h3>
				{/* biome-ignore lint/a11y/useMediaCaption: doctor-recorded audio */}
				<audio src={recording.audioUrl} controls className="w-full" />
			</div>

			{/* Transcript */}
			<div className="rounded-xl border bg-card p-6 space-y-4">
				<div className="flex items-center justify-between">
					<h3 className="font-medium">Transcript</h3>
					<div className="flex items-center gap-2">
						{recording.transcriptStatus === "done" && (
							<Button variant="outline" size="sm" className="gap-1.5" asChild>
								<Link href={`/dashboard/ai-chat?transcript=${recordingId}`}>
									<Bot className="size-3.5" />
									Chat with AI
								</Link>
							</Button>
						)}
						{canTranscribe && (
							<Button
								size="sm"
								className="gap-1.5"
								onClick={handleTranscribe}
								disabled={isTranscribing}
							>
								{isTranscribing ? (
									<Loader2 className="size-3.5 animate-spin" />
								) : (
									<RefreshCw className="size-3.5" />
								)}
								{isTranscribing ? "Transcribing…" : "Generate Transcript"}
							</Button>
						)}
					</div>
				</div>

				{recording.transcriptStatus === "processing" && (
					<div className="flex items-center gap-3 text-muted-foreground text-sm">
						<Loader2 className="size-4 animate-spin" />
						Generating transcript…
					</div>
				)}

				{recording.transcriptStatus === "pending" && (
					<p className="text-muted-foreground text-sm">
						No transcript yet. Click "Generate Transcript" to create one.
					</p>
				)}

				{recording.transcriptStatus === "error" && (
					<p className="text-red-600 text-sm dark:text-red-400">
						Transcription failed. Please try again.
					</p>
				)}

				{recording.transcriptStatus === "done" &&
					Boolean(recording.transcript) && (
						<div className="space-y-2">
							<button
								type="button"
								className="text-muted-foreground text-xs hover:text-foreground"
								onClick={() => setTranscriptExpanded((v) => !v)}
							>
								{transcriptExpanded ? "Collapse" : "Expand"}
							</button>
							{transcriptExpanded &&
								(() => {
									const data = recording.transcript as any;
									const isStructured =
										data &&
										typeof data === "object" &&
										Array.isArray(data.segments);
									if (isStructured) {
										return (
											<div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 rounded-md border p-4 bg-muted/30">
												{data.segments.map((segment: any, idx: number) => (
													<div key={idx} className="flex gap-4 group">
														<button
															type="button"
															onClick={() => {
																const audioEl = document.querySelector("audio");
																if (audioEl) {
																	audioEl.currentTime = segment.start;
																	audioEl.play();
																}
															}}
															className="text-primary hover:underline font-mono text-xs shrink-0 mt-1"
														>
															{Math.floor(segment.start / 60)}:
															{Math.floor(segment.start % 60)
																.toString()
																.padStart(2, "0")}
														</button>
														<div>
															<span className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">
																{segment.speaker || "Speaker"}
															</span>
															<p className="text-sm mt-0.5 leading-relaxed">
																{segment.text}
															</p>
														</div>
													</div>
												))}
											</div>
										);
									}
									// Legacy or plain text
									const textValue =
										typeof data === "string"
											? data
											: JSON.stringify(data, null, 2);
									return (
										<Textarea
											readOnly
											value={textValue}
											className="min-h-[200px] resize-y font-mono text-sm leading-relaxed"
										/>
									);
								})()}
						</div>
					)}
			</div>
		</div>
	);
}
