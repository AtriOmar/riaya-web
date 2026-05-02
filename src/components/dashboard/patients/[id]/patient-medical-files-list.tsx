"use client";

import { Calendar, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { isLikelyImageUrl } from "@/lib/document-file";
import { cn } from "@/lib/utils";
import type { PatientMedicalFile } from "@/services/types";
import {
	formatMedicalFileType,
	medicalFileTypeBadgeClassName,
} from "./medical-file-types";

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
			className="flex flex-col items-center gap-1.5 p-2 rounded-lg border bg-background max-w-[5.75rem] transition-colors hover:bg-accent/50"
		>
			<div className="flex justify-center items-center w-14 h-14 rounded-md border bg-muted overflow-hidden shrink-0">
				{isImage ? (
					// biome-ignore lint/performance/noImgElement: arbitrary CDN URLs + no remotePatterns guarantee
					<img src={url} alt="" className="w-full h-full object-cover" />
				) : (
					<FileText className="w-6 h-6 text-muted-foreground" />
				)}
			</div>
			<span className="text-primary text-[0.7rem] text-center leading-tight hover:underline">
				Document {index + 1}
			</span>
		</a>
	);
}

type PatientMedicalFilesListProps = {
	medicalFiles: PatientMedicalFile[] | null | undefined;
};

export function PatientMedicalFilesList({
	medicalFiles,
}: PatientMedicalFilesListProps) {
	return (
		<div className="space-y-4 lg:col-span-2">
			<h4 className="font-semibold text-lg">Medical Files</h4>

			{medicalFiles?.length ? (
				<div className="space-y-3">
					{medicalFiles.map((file) => (
						<div
							key={file.id}
							className="flex items-start gap-3 p-4 border rounded-xl bg-card"
						>
							<FileText className="w-5 h-5 mt-0.5 text-primary shrink-0" />
							<div className="grow">
								<div className="flex items-center gap-2 flex-wrap">
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
								{file.documents && file.documents.length > 0 && (
									<div className="flex flex-wrap gap-3 mt-2">
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
								<div className="flex items-center gap-1 mt-2 text-muted-foreground text-xs">
									<Calendar className="w-3 h-3" />
									{file.date
										? new Date(file.date).toLocaleDateString("en-GB")
										: "—"}
								</div>
							</div>
						</div>
					))}
				</div>
			) : (
				<p className="py-8 text-muted-foreground text-center">
					No medical files yet.
				</p>
			)}
		</div>
	);
}
