"use client";

import { Upload, X } from "lucide-react";
import { useCallback, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

async function getCroppedImg(imageSrc: string, pixelCrop: Area): Promise<Blob> {
	const image = new Image();
	image.src = imageSrc;
	await new Promise((resolve) => {
		image.onload = resolve;
	});

	const canvas = document.createElement("canvas");
	canvas.width = pixelCrop.width;
	canvas.height = pixelCrop.height;
	const ctx = canvas.getContext("2d");
	if (!ctx) throw new Error("Could not get canvas 2d context");
	ctx.drawImage(
		image,
		pixelCrop.x,
		pixelCrop.y,
		pixelCrop.width,
		pixelCrop.height,
		0,
		0,
		pixelCrop.width,
		pixelCrop.height,
	);
	return new Promise((resolve, reject) => {
		canvas.toBlob(
			(blob) => {
				if (!blob) reject(new Error("Failed to create blob"));
				else resolve(blob);
			},
			"image/jpeg",
			0.9,
		);
	});
}

type Props = {
	imageUrl: string;
	aspect: number;
	/** Receives the cropped image. Throw to keep the cropper open. */
	onSave: (blob: Blob) => Promise<void>;
	onCancel: () => void;
	errorMessage?: string;
};

export default function ImageCropper({
	imageUrl,
	aspect,
	onSave,
	onCancel,
	errorMessage = "Failed to save the image",
}: Props) {
	const [crop, setCrop] = useState({ x: 0, y: 0 });
	const [zoom, setZoom] = useState(1);
	const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
	const [saving, setSaving] = useState(false);

	const onCropComplete = useCallback((_: Area, pixels: Area) => {
		setCroppedAreaPixels(pixels);
	}, []);

	async function handleSave() {
		if (!croppedAreaPixels) return;
		setSaving(true);
		try {
			await onSave(await getCroppedImg(imageUrl, croppedAreaPixels));
		} catch {
			toast.error(errorMessage);
		} finally {
			setSaving(false);
		}
	}

	return (
		<div className="mt-2">
			<div className="relative h-[250px] overflow-hidden rounded-lg">
				<Cropper
					image={imageUrl}
					crop={crop}
					zoom={zoom}
					aspect={aspect}
					onCropChange={setCrop}
					onCropComplete={onCropComplete}
					onZoomChange={setZoom}
				/>
			</div>
			<div className="flex justify-center gap-2 mt-4">
				<Button onClick={handleSave} disabled={saving}>
					<Upload className="w-4 h-4" />
					{saving ? "Saving..." : "Save"}
				</Button>
				<Button variant="destructive" onClick={onCancel} disabled={saving}>
					<X className="w-4 h-4" />
					Cancel
				</Button>
			</div>
		</div>
	);
}
