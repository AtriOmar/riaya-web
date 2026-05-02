"use client";

import type { DragEndEvent } from "@dnd-kit/core";
import {
	closestCenter,
	DndContext,
	KeyboardSensor,
	PointerSensor,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import {
	arrayMove,
	SortableContext,
	sortableKeyboardCoordinates,
	useSortable,
	verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { FileText, GripVertical, Upload, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { isImageFile, isLikelyImageUrl } from "@/lib/document-file";
import { cn } from "@/lib/utils";

export interface DocumentItem {
	id: string;
	file?: File;
	name: string;
	cdnUrl?: string;
}

interface SortableDocumentItemProps {
	item: DocumentItem;
	onRemove: (id: string) => void;
}

function SortableDocumentItem({ item, onRemove }: SortableDocumentItemProps) {
	const {
		attributes,
		listeners,
		setNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable({ id: item.id });

	const [blobPreview, setBlobPreview] = useState<string | null>(null);

	useEffect(() => {
		if (!item.file || !isImageFile(item.file)) {
			setBlobPreview(null);
			return;
		}
		const url = URL.createObjectURL(item.file);
		setBlobPreview(url);
		return () => URL.revokeObjectURL(url);
	}, [item.file]);

	const cdnIsImage = item.cdnUrl ? isLikelyImageUrl(item.cdnUrl) : false;
	const showImage =
		Boolean(blobPreview) || (Boolean(item.cdnUrl) && cdnIsImage);

	const imageSrc =
		blobPreview ?? (cdnIsImage && item.cdnUrl ? item.cdnUrl : null);

	const style = {
		transform: CSS.Transform.toString(transform),
		transition,
	};

	return (
		<div
			ref={setNodeRef}
			style={style}
			className={cn(
				"flex items-center gap-2 p-3 border rounded-lg bg-background",
				isDragging && "opacity-50",
			)}
		>
			<button
				type="button"
				{...attributes}
				{...listeners}
				className="cursor-grab text-muted-foreground hover:text-foreground shrink-0"
			>
				<GripVertical className="w-4 h-4" />
			</button>
			<div className="flex justify-center items-center w-11 h-11 rounded-md border bg-muted overflow-hidden shrink-0">
				{showImage && imageSrc ? (
					// biome-ignore lint/performance/noImgElement: blob: URLs and external CDN paths
					<img src={imageSrc} alt="" className="w-full h-full object-cover" />
				) : (
					<FileText className="w-5 h-5 text-muted-foreground" />
				)}
			</div>
			<span className="grow text-sm truncate">{item.name}</span>
			<Button
				type="button"
				variant="ghost"
				size="sm"
				className="w-7 h-7 p-0 text-muted-foreground hover:text-destructive shrink-0"
				onClick={() => onRemove(item.id)}
			>
				<X className="w-4 h-4" />
			</Button>
		</div>
	);
}

interface DocumentUploadProps {
	value: DocumentItem[];
	onChange: (items: DocumentItem[]) => void;
	maxFiles?: number;
	maxFileSize?: number;
	className?: string;
}

export default function DocumentUpload({
	value = [],
	onChange,
	maxFiles = 10,
	maxFileSize = 20,
	className,
}: DocumentUploadProps) {
	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
		useSensor(KeyboardSensor, {
			coordinateGetter: sortableKeyboardCoordinates,
		}),
	);

	const onDrop = useCallback(
		(acceptedFiles: File[]) => {
			const errors: string[] = [];
			const newItems: DocumentItem[] = [];

			for (let i = 0; i < acceptedFiles.length; i++) {
				const file = acceptedFiles[i];

				if (value.length + newItems.length >= maxFiles) {
					errors.push(`Maximum ${maxFiles} files allowed`);
					break;
				}

				if (file.size > maxFileSize * 1024 * 1024) {
					errors.push(`${file.name}: File must be less than ${maxFileSize}MB`);
					continue;
				}

				newItems.push({
					id: `${Date.now()}-${i}`,
					file,
					name: file.name,
				});
			}

			if (errors.length > 0) toast.error(errors.join("\n"));
			if (newItems.length > 0) onChange([...value, ...newItems]);
		},
		[value, onChange, maxFiles, maxFileSize],
	);

	const handleDragEnd = (event: DragEndEvent) => {
		const { active, over } = event;
		if (active.id !== over?.id) {
			const oldIndex = value.findIndex((item) => item.id === active.id);
			const newIndex = value.findIndex((item) => item.id === over?.id);
			if (oldIndex !== -1 && newIndex !== -1) {
				onChange(arrayMove(value, oldIndex, newIndex));
			}
		}
	};

	const removeItem = (id: string) => {
		onChange(value.filter((item) => item.id !== id));
	};

	const { getRootProps, getInputProps, isDragActive } = useDropzone({
		onDrop,
		accept: {
			"application/pdf": [".pdf"],
			"image/*": [".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".tiff"],
			"application/msword": [".doc"],
			"application/vnd.openxmlformats-officedocument.wordprocessingml.document":
				[".docx"],
		},
		maxFiles: maxFiles - value.length,
		maxSize: maxFileSize * 1024 * 1024,
		disabled: value.length >= maxFiles,
	});

	return (
		<div className={cn("space-y-3", className)}>
			<div
				{...getRootProps()}
				className={cn(
					"p-4 border-2 border-dashed rounded-lg text-center cursor-pointer transition-colors",
					isDragActive
						? "border-primary bg-primary/5"
						: "border-muted-foreground/25 hover:border-muted-foreground/50",
					value.length >= maxFiles && "opacity-50 pointer-events-none",
				)}
			>
				<input {...getInputProps()} />
				<Upload className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
				<p className="font-medium text-sm">
					{isDragActive
						? "Drop files here..."
						: "Drop files or click to upload"}
				</p>
				<p className="mt-1 text-muted-foreground text-xs">
					PDF, images, Word documents • up to {maxFileSize}MB each •{" "}
					{value.length}/{maxFiles}
				</p>
			</div>

			{value.length > 0 && (
				<DndContext
					sensors={sensors}
					collisionDetection={closestCenter}
					onDragEnd={handleDragEnd}
					id="document-upload-list"
				>
					<SortableContext
						items={value.map((item) => item.id)}
						strategy={verticalListSortingStrategy}
					>
						<div className="space-y-2">
							{value.map((item) => (
								<SortableDocumentItem
									key={item.id}
									item={item}
									onRemove={removeItem}
								/>
							))}
						</div>
					</SortableContext>
				</DndContext>
			)}
		</div>
	);
}
