import { Trash2, Upload } from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";
import { useFormContext } from "react-hook-form";
import ImageUploadModal from "@/components/dashboard/profile/image-upload-modal";
import { Label } from "@/components/ui/label";
import type { FormValues } from "./schema";

// Width / height of an ID card.
const CIN_ASPECT = 14 / 9;

type Props = {
	name: "cinRecto" | "cinVerso";
	label: string;
	placeholderSrc: string;
};

export default function CinField({ name, label, placeholderSrc }: Props) {
	const {
		watch,
		setValue,
		formState: { errors },
	} = useFormContext<FormValues>();
	const file = watch(name);
	const [modalOpen, setModalOpen] = useState(false);

	// Created in an effect so the cleanup that revokes it pairs with the creation
	// (a memoized URL stays revoked after StrictMode re-runs the effects).
	const [previewUrl, setPreviewUrl] = useState<string | null>(null);
	useEffect(() => {
		if (!file) {
			setPreviewUrl(null);
			return;
		}
		const url = URL.createObjectURL(file);
		setPreviewUrl(url);
		return () => URL.revokeObjectURL(url);
	}, [file]);

	const error = errors[name];

	return (
		<div className="space-y-2">
			<ImageUploadModal
				open={modalOpen}
				onClose={() => setModalOpen(false)}
				title={label}
				aspect={CIN_ASPECT}
				onSave={async (blob) => {
					setValue(name, new File([blob], `${name}.jpg`, { type: blob.type }), {
						shouldValidate: true,
					});
				}}
			/>
			<Label>
				{label} <span className="text-destructive">*</span>
			</Label>
			<div className="relative mt-2 w-full max-w-[300px] group overflow-hidden rounded-lg border-2 border-dashed hover:border-primary transition">
				{previewUrl ? (
					<>
						{/* biome-ignore lint/performance/noImgElement: blob URL preview, next/image doesn't support blob URLs */}
						<img
							src={previewUrl}
							alt={label}
							className="w-full object-cover aspect-[14/9]"
						/>
						<div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col sm:flex-row gap-2 items-center justify-center transition-opacity duration-200">
							<button
								type="button"
								className="inline-flex items-center justify-center h-8 px-3 rounded-md text-xs font-medium transition-colors bg-green-500/40 border border-green-500/50 text-green-100 hover:bg-green-500/60 hover:text-white"
								onClick={() => setModalOpen(true)}
							>
								<Upload className="size-4 mr-2" />
								Change
							</button>
							<button
								type="button"
								className="inline-flex items-center justify-center h-8 px-3 rounded-md text-xs font-medium transition-colors bg-red-500/40 border border-red-500/50 text-red-100 hover:bg-red-500/60 hover:text-white"
								onClick={() => setValue(name, undefined as never)}
							>
								<Trash2 className="size-4 mr-2" />
								Remove
							</button>
						</div>
					</>
				) : (
					<button
						type="button"
						onClick={() => setModalOpen(true)}
						aria-label={`Upload ${label}. Example card shown faded.`}
						className="block w-full h-full aspect-[14/9]"
					>
						<Image
							src={placeholderSrc}
							alt=""
							fill
							className="opacity-35 object-cover"
							sizes="300px"
						/>
						<div className="z-10 absolute inset-0 flex justify-center items-center pointer-events-none">
							<span className="flex justify-center items-center bg-background/90 shadow-md backdrop-blur-[2px] ring-border rounded-md ring-1 size-12 text-primary">
								<Upload className="size-5" aria-hidden />
							</span>
						</div>
					</button>
				)}
			</div>
			{error && (
				<p className="mt-1 text-destructive text-sm">{error.message}</p>
			)}
		</div>
	);
}
