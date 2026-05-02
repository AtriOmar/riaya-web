"use client";

import { Calendar, FileText, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import ConfirmationDialog from "@/components/confirmation-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { isLikelyImageUrl } from "@/lib/document-file";
import { cn } from "@/lib/utils";
import { deleteMedicalFile, updateMedicalFile } from "@/services";
import type { PatientMedicalFile } from "@/services/types";
import {
	formatMedicalFileType,
	MEDICAL_FILE_TYPES,
	medicalFileTypeBadgeClassName,
} from "./medical-file-types";

function toDatetimeLocalValue(d: Date): string {
	const pad = (n: number) => String(n).padStart(2, "0");
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fileToDatetimeLocal(file: PatientMedicalFile): string {
	if (!file.date) return toDatetimeLocalValue(new Date());
	const d = new Date(file.date);
	if (Number.isNaN(d.getTime())) return toDatetimeLocalValue(new Date());
	return toDatetimeLocalValue(d);
}

function MedicalDocumentAttachment({
	url,
	index,
}: {
	url: string;
	index: number;
}) {
	const isImage = isLikelyImageUrl(url);
	return (
		<a
			href={url}
			target="_blank"
			rel="noopener noreferrer"
			className="flex max-w-[5.75rem] flex-col items-center gap-1.5 rounded-lg border bg-background p-2 transition-colors hover:bg-accent/50"
		>
			<div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted">
				{isImage ? (
					// biome-ignore lint/performance/noImgElement: arbitrary CDN URLs + no remotePatterns guarantee
					<img src={url} alt="" className="size-full object-cover" />
				) : (
					<FileText className="size-6 text-muted-foreground" />
				)}
			</div>
			<span className="text-center text-[0.7rem] text-primary leading-tight hover:underline">
				Document {index + 1}
			</span>
		</a>
	);
}

type Draft = {
	title: string;
	description: string;
	type: string;
	dateLocal: string;
};

function draftFromFile(file: PatientMedicalFile): Draft {
	return {
		title: file.title ?? "",
		description: file.description ?? "",
		type: file.type ?? MEDICAL_FILE_TYPES[0].value,
		dateLocal: fileToDatetimeLocal(file),
	};
}

function MedicalFileCard({
	file,
	patientId,
	onChanged,
}: {
	file: PatientMedicalFile;
	patientId: number;
	onChanged: () => void;
}) {
	const [isEditing, setIsEditing] = useState(false);
	const [draft, setDraft] = useState<Draft>(() => draftFromFile(file));
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
	const [isSaving, setIsSaving] = useState(false);
	const [isDeleting, setIsDeleting] = useState(false);

	const startEdit = () => {
		setDraft(draftFromFile(file));
		setIsEditing(true);
	};

	const cancelEdit = () => {
		setIsEditing(false);
		setDraft(draftFromFile(file));
	};

	const saveChanges = async () => {
		if (!draft.title.trim()) {
			toast.error("Title is required");
			return;
		}
		setIsSaving(true);
		try {
			await updateMedicalFile(patientId, {
				medicalFileId: file.id,
				title: draft.title.trim(),
				description: draft.description,
				type: draft.type,
				date: new Date(draft.dateLocal).toISOString(),
			});
			toast.success("Medical file updated");
			setIsEditing(false);
			onChanged();
		} catch {
			toast.error("Failed to update medical file");
		} finally {
			setIsSaving(false);
		}
	};

	const confirmDelete = async () => {
		setIsDeleting(true);
		try {
			await deleteMedicalFile(patientId, file.id);
			toast.success("Medical file deleted");
			setDeleteDialogOpen(false);
			onChanged();
		} catch {
			toast.error("Failed to delete medical file");
		} finally {
			setIsDeleting(false);
		}
	};

	return (
		<div className="relative flex items-start gap-3 rounded-xl border bg-card p-4 pr-12">
			<FileText className="mt-0.5 size-5 shrink-0 text-primary" />

			<div className="min-w-0 grow">
				{isEditing ? (
					<div className="space-y-3">
						<div>
							<p className="mb-1 text-muted-foreground text-xs">Title</p>
							<Input
								value={draft.title}
								onChange={(e) =>
									setDraft((d) => ({ ...d, title: e.target.value }))
								}
							/>
						</div>
						<div>
							<p className="mb-1 text-muted-foreground text-xs">Type</p>
							<div className="flex flex-wrap gap-2">
								{MEDICAL_FILE_TYPES.map(
									({ value, label, accentClassName, typeButtonUnselected }) => (
										<button
											key={value}
											type="button"
											className={cn(
												"min-w-[5.5rem] flex-1 rounded-md border px-2 py-2 text-center font-medium text-xs transition-colors sm:text-sm",
												draft.type === value
													? accentClassName
													: typeButtonUnselected,
											)}
											onClick={() => setDraft((d) => ({ ...d, type: value }))}
										>
											{label}
										</button>
									),
								)}
							</div>
						</div>
						<div>
							<p className="mb-1 text-muted-foreground text-xs">Date & time</p>
							<Input
								type="datetime-local"
								value={draft.dateLocal}
								onChange={(e) =>
									setDraft((d) => ({ ...d, dateLocal: e.target.value }))
								}
							/>
						</div>
						<div>
							<p className="mb-1 text-muted-foreground text-xs">Description</p>
							<Textarea
								value={draft.description}
								onChange={(e) =>
									setDraft((d) => ({ ...d, description: e.target.value }))
								}
								rows={3}
								placeholder="Optional notes…"
							/>
						</div>
					</div>
				) : (
					<>
						<div className="flex flex-wrap items-center gap-2">
							<p className="font-medium">{file.title}</p>
							<Badge
								variant="outline"
								className={cn(
									"text-xs",
									medicalFileTypeBadgeClassName(file.type),
								)}
							>
								{formatMedicalFileType(file.type)}
							</Badge>
						</div>
						{file.description && (
							<p className="mt-1 text-muted-foreground text-sm">
								{file.description}
							</p>
						)}
					</>
				)}

				{file.documents && file.documents.length > 0 && (
					<div className="mt-2 flex flex-wrap gap-3">
						{file.documents
							.filter((u): u is string => Boolean(u))
							.map((url, i) => (
								<MedicalDocumentAttachment
									key={`${file.id}-${url}`}
									url={url}
									index={i}
								/>
							))}
					</div>
				)}

				{!isEditing && (
					<div className="mt-2 flex items-center gap-1 text-muted-foreground text-xs">
						<Calendar className="size-3" />
						{file.date ? new Date(file.date).toLocaleDateString("en-GB") : "—"}
					</div>
				)}

				{isEditing && (
					<div className="mt-3 flex flex-wrap gap-2">
						<Button
							type="button"
							variant="outline"
							onClick={cancelEdit}
							disabled={isSaving}
						>
							Cancel
						</Button>
						<Button type="button" onClick={saveChanges} disabled={isSaving}>
							{isSaving ? "Saving…" : "Save changes"}
						</Button>
					</div>
				)}
			</div>

			{!isEditing && (
				<div className="absolute top-3 right-3 flex gap-0.5">
					<Button
						type="button"
						variant="ghost"
						size="icon-sm"
						className="text-muted-foreground hover:text-foreground"
						onClick={startEdit}
						aria-label="Edit medical file"
					>
						<Pencil className="size-4" />
					</Button>
					<Button
						type="button"
						variant="ghost"
						size="icon-sm"
						className="text-muted-foreground hover:text-destructive"
						onClick={() => setDeleteDialogOpen(true)}
						aria-label="Delete medical file"
					>
						<Trash2 className="size-4" />
					</Button>
				</div>
			)}

			<ConfirmationDialog
				open={deleteDialogOpen}
				onOpenChange={setDeleteDialogOpen}
				title="Delete medical file?"
				description="This removes the file from the patient record. Documents already uploaded stay on storage but will no longer be linked here."
				variant="destructive"
				confirmText="Delete"
				onConfirm={confirmDelete}
				isLoading={isDeleting}
				alertTitle="This cannot be undone"
				alertMessage="You can add a new medical file later if needed."
			/>
		</div>
	);
}

type PatientMedicalFilesListProps = {
	patientId: number;
	medicalFiles: PatientMedicalFile[] | null | undefined;
	onChanged: () => void;
};

export function PatientMedicalFilesList({
	patientId,
	medicalFiles,
	onChanged,
}: PatientMedicalFilesListProps) {
	return (
		<div className="space-y-4 lg:col-span-2">
			<h4 className="font-semibold text-lg">Medical Files</h4>

			{medicalFiles?.length ? (
				<div className="space-y-3">
					{medicalFiles.map((file) => (
						<MedicalFileCard
							key={file.id}
							file={file}
							patientId={patientId}
							onChanged={onChanged}
						/>
					))}
				</div>
			) : (
				<p className="py-8 text-center text-muted-foreground">
					No medical files yet.
				</p>
			)}
		</div>
	);
}
