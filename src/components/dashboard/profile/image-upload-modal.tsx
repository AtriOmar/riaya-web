"use client";

import { Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import ImageCropper from "@/components/dashboard/profile/image-cropper";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";

type Props = {
	open: boolean;
	onClose: () => void;
	title: string;
	/** Width / height of the crop, e.g. 1 for a square. */
	aspect: number;
	/** Receives the cropped image. Throw to keep the modal open. */
	onSave: (blob: Blob) => Promise<void>;
	errorMessage?: string;
};

/** Pick or drop an image, crop it, hand the result to the caller. */
export default function ImageUploadModal({
	open,
	onClose,
	title,
	aspect,
	onSave,
	errorMessage,
}: Props) {
	const [imageUrl, setImageUrl] = useState<string | null>(null);
	const inputRef = useRef<HTMLInputElement>(null);

	// Free the preview whenever it is replaced, cleared or the modal unmounts.
	useEffect(() => {
		return () => {
			if (imageUrl) URL.revokeObjectURL(imageUrl);
		};
	}, [imageUrl]);

	function handleFile(file: File) {
		if (!file.type.startsWith("image/")) return;
		setImageUrl(URL.createObjectURL(file));
	}

	function close() {
		setImageUrl(null);
		onClose();
	}

	return (
		<Dialog open={open} onOpenChange={(v) => !v && close()}>
			<DialogContent className="max-w-[500px]">
				<DialogHeader>
					<DialogTitle>{title}</DialogTitle>
				</DialogHeader>

				{imageUrl ? (
					<ImageCropper
						imageUrl={imageUrl}
						aspect={aspect}
						onSave={async (blob) => {
							await onSave(blob);
							close();
						}}
						onCancel={() => setImageUrl(null)}
						errorMessage={errorMessage}
					/>
				) : (
					// biome-ignore lint/a11y/useKeyWithClickEvents: drop zone contains a visible <Button> for keyboard users
					<div
						className="flex flex-col justify-center items-center p-4 border-2 hover:border-primary border-dashed rounded-lg h-[250px] transition cursor-pointer"
						onDragOver={(e) => e.preventDefault()}
						onDrop={(e) => {
							e.preventDefault();
							const file = e.dataTransfer.files[0];
							if (file) handleFile(file);
						}}
						onClick={() => inputRef.current?.click()}
					>
						<input
							ref={inputRef}
							type="file"
							accept="image/*"
							className="hidden"
							onChange={(e) => {
								const file = e.target.files?.[0];
								if (file) handleFile(file);
								e.target.value = "";
							}}
						/>
						<Button variant="default" size="sm" type="button">
							<Upload className="w-4 h-4" />
							Upload
						</Button>
						<p className="mt-2 text-muted-foreground text-sm text-center">
							Or drop an image here
						</p>
					</div>
				)}
			</DialogContent>
		</Dialog>
	);
}
