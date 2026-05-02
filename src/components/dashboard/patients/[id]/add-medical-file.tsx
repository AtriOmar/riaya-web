"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { uploadToR2 } from "@/lib/upload";
import { cn } from "@/lib/utils";
import { createMedicalFile } from "@/services";
import DocumentUpload, { type DocumentItem } from "./document-upload";
import {
	MEDICAL_FILE_TYPE_VALUES,
	MEDICAL_FILE_TYPES,
} from "./medical-file-types";

const schema = z.object({
	title: z.string().min(1, "Title is required"),
	type: z.string().refine((val) => MEDICAL_FILE_TYPE_VALUES.includes(val), {
		message: "Select a type",
	}),
	date: z.string().min(1, "Date is required"),
	description: z.string(),
});

type FormValues = z.infer<typeof schema>;

function toDatetimeLocalValue(d: Date): string {
	const pad = (n: number) => String(n).padStart(2, "0");
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatTitleDate(datetimeLocal: string): string {
	const parsed = new Date(datetimeLocal);
	if (Number.isNaN(parsed.getTime())) return datetimeLocal;
	return parsed.toLocaleString(undefined, {
		year: "numeric",
		month: "numeric",
		day: "numeric",
	});
}

function defaultTitleFromTypeAndDate(
	typeValue: string,
	dateValue: string,
): string {
	const label =
		MEDICAL_FILE_TYPES.find((t) => t.value === typeValue)?.label ?? typeValue;
	return `${label} ${formatTitleDate(dateValue)}`;
}

const DEFAULT_MEDICAL_FILE_TYPE = MEDICAL_FILE_TYPES[0].value;

function getDefaultFormValues(): FormValues {
	const date = toDatetimeLocalValue(new Date());
	return {
		type: DEFAULT_MEDICAL_FILE_TYPE,
		date,
		title: defaultTitleFromTypeAndDate(DEFAULT_MEDICAL_FILE_TYPE, date),
		description: "",
	};
}

type AddMedicalFileProps = {
	patientId: number;
	onFileAdded: () => void;
};

export function AddMedicalFile({
	patientId,
	onFileAdded,
}: AddMedicalFileProps) {
	const [documents, setDocuments] = useState<DocumentItem[]>([]);
	const titleTouchedRef = useRef(false);

	const {
		register,
		handleSubmit,
		reset,
		setValue,
		watch,
		formState: { errors, isSubmitting },
	} = useForm<FormValues>({
		resolver: zodResolver(schema),
		defaultValues: getDefaultFormValues(),
	});

	const selectedType = watch("type");
	const watchedDate = watch("date");

	useEffect(() => {
		if (!watchedDate || titleTouchedRef.current) return;
		setValue("title", defaultTitleFromTypeAndDate(selectedType, watchedDate), {
			shouldValidate: true,
		});
	}, [selectedType, watchedDate, setValue]);

	async function onSubmit(values: FormValues) {
		try {
			const uploadedUrls: string[] = [];
			for (const doc of documents) {
				if (doc.file) {
					const cdnUrl = await uploadToR2(doc.file, "medical-files");
					uploadedUrls.push(cdnUrl);
				} else if (doc.cdnUrl) {
					uploadedUrls.push(doc.cdnUrl);
				}
			}

			await createMedicalFile(patientId, {
				type: values.type,
				date: new Date(values.date).toISOString(),
				title: values.title,
				description: values.description,
				documents: uploadedUrls,
			});

			toast.success("Medical file added");
			onFileAdded();
			reset(getDefaultFormValues());
			titleTouchedRef.current = false;
			setDocuments([]);
		} catch {
			toast.error("Failed to add medical file");
		}
	}

	return (
		<div className="space-y-4">
			<h4 className="font-semibold text-lg">Add Medical File</h4>
			<form
				onSubmit={handleSubmit(onSubmit)}
				className="space-y-4 p-4 border rounded-xl bg-card"
			>
				<div>
					<Label>
						Type <span className="text-destructive">*</span>
					</Label>
					<div className="flex flex-wrap gap-2 mt-1">
						{MEDICAL_FILE_TYPES.map(
							({ value, label, accentClassName, typeButtonUnselected }) => (
								<button
									key={value}
									type="button"
									className={cn(
										"flex-1 min-w-[5.5rem] px-2 py-2 border rounded-md font-medium text-xs sm:text-sm text-center transition-colors",
										selectedType === value
											? accentClassName
											: typeButtonUnselected,
									)}
									onClick={() =>
										setValue("type", value, { shouldValidate: true })
									}
								>
									{label}
								</button>
							),
						)}
					</div>
					{errors.type && (
						<p className="mt-1 text-destructive text-sm">
							{errors.type.message}
						</p>
					)}
				</div>

				<div>
					<Label htmlFor="title">
						Title <span className="text-destructive">*</span>
					</Label>
					<Input
						id="title"
						{...register("title", {
							onChange: () => {
								titleTouchedRef.current = true;
							},
						})}
					/>
					{errors.title && (
						<p className="mt-1 text-destructive text-sm">
							{errors.title.message}
						</p>
					)}
				</div>

				<div>
					<Label htmlFor="date">
						Date & time <span className="text-destructive">*</span>
					</Label>
					<Input
						id="date"
						type="datetime-local"
						placeholder="2026-05-02T15:00"
						{...register("date")}
					/>
					{errors.date && (
						<p className="mt-1 text-destructive text-sm">
							{errors.date.message}
						</p>
					)}
				</div>

				<div>
					<Label htmlFor="description">Description</Label>
					<Textarea
						id="description"
						placeholder="Optional notes about this file…"
						{...register("description")}
						rows={3}
					/>
				</div>

				<div>
					<Label className="block mb-1">Documents</Label>
					<DocumentUpload
						value={documents}
						onChange={setDocuments}
						maxFiles={10}
						maxFileSize={20}
					/>
				</div>

				<Button type="submit" className="w-full" disabled={isSubmitting}>
					{isSubmitting ? "Adding…" : "Add Medical File"}
				</Button>
			</form>
		</div>
	);
}
