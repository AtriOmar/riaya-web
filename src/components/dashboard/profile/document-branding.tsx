"use client";

import { ImagePlus, Loader2, Lock, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getErrorMessage } from "@/lib/error-handling";
import { uploadToR2 } from "@/lib/upload";
import { useGetApiBillingSubscription } from "@/services/generated/billing/billing";
import { usePutApiDoctorsMeBranding } from "@/services/generated/doctors/doctors";

const ACCEPTED_TYPES = ["image/png", "image/jpeg"];
const MAX_BYTES = 2 * 1024 * 1024;

type Slot = "logoUrl" | "stampUrl";

const SLOTS: { key: Slot; title: string; hint: string }[] = [
	{
		key: "logoUrl",
		title: "Logo",
		hint: "Top left of the invoice, next to your name.",
	},
	{
		key: "stampUrl",
		title: "Stamp & signature",
		hint: "Bottom of the invoice. A PNG with a transparent background looks best.",
	},
];

function BrandingSlot({
	title,
	hint,
	url,
	locked,
	busy,
	onPick,
	onRemove,
}: {
	title: string;
	hint: string;
	url: string | null;
	locked: boolean;
	busy: boolean;
	onPick: (file: File) => void;
	onRemove: () => void;
}) {
	const inputRef = useRef<HTMLInputElement>(null);

	return (
		<div className="flex flex-col gap-3 rounded-xl border p-4">
			<div>
				<p className="font-medium text-sm">{title}</p>
				<p className="text-muted-foreground text-xs">{hint}</p>
			</div>
			<div className="flex h-28 items-center justify-center rounded-lg bg-muted/50">
				{busy ? (
					<Loader2 className="size-5 animate-spin text-muted-foreground" />
				) : url ? (
					// biome-ignore lint/performance/noImgElement: CDN image preview, any size
					<img
						src={url}
						alt={title}
						className="max-h-24 max-w-[85%] object-contain"
					/>
				) : (
					<ImagePlus className="size-6 text-muted-foreground" />
				)}
			</div>
			<input
				ref={inputRef}
				type="file"
				accept={ACCEPTED_TYPES.join(",")}
				className="hidden"
				onChange={(e) => {
					const file = e.target.files?.[0];
					e.target.value = "";
					if (file) onPick(file);
				}}
			/>
			<div className="flex gap-2">
				<Button
					size="sm"
					variant="outline"
					className="flex-1"
					disabled={locked || busy}
					onClick={() => inputRef.current?.click()}
				>
					{url ? "Replace" : "Upload"}
				</Button>
				{url && (
					<Button
						size="sm"
						variant="ghost"
						disabled={busy}
						onClick={onRemove}
						aria-label={`Remove ${title.toLowerCase()}`}
					>
						<Trash2 className="size-4" />
					</Button>
				)}
			</div>
		</div>
	);
}

/** Logo and stamp printed on invoices (Pro). Free doctors see what they'd get. */
export default function DocumentBranding({
	logoUrl,
	stampUrl,
	onSaved,
}: {
	logoUrl: string | null;
	stampUrl: string | null;
	onSaved: () => void;
}) {
	const { data: billing } = useGetApiBillingSubscription();
	const { trigger } = usePutApiDoctorsMeBranding();
	const [busySlot, setBusySlot] = useState<Slot | null>(null);

	const locked = billing ? !billing.plan.canBrandDocuments : true;
	const current = { logoUrl, stampUrl };

	async function save(slot: Slot, url: string | null) {
		await trigger({ ...current, [slot]: url });
		onSaved();
	}

	async function pick(slot: Slot, file: File) {
		if (!ACCEPTED_TYPES.includes(file.type)) {
			toast.error("Use a PNG or JPEG image.");
			return;
		}
		if (file.size > MAX_BYTES) {
			toast.error("The image must be under 2 MB.");
			return;
		}
		setBusySlot(slot);
		try {
			const url = await uploadToR2(file, "practice-branding");
			await save(slot, url);
			toast.success("Saved. It will appear on your next invoices.");
		} catch (err) {
			toast.error(getErrorMessage(err, "Could not save the image."));
		} finally {
			setBusySlot(null);
		}
	}

	async function remove(slot: Slot) {
		setBusySlot(slot);
		try {
			await save(slot, null);
		} catch (err) {
			toast.error(getErrorMessage(err, "Could not remove the image."));
		} finally {
			setBusySlot(null);
		}
	}

	return (
		<section className="mt-8 space-y-4">
			<div className="flex flex-wrap items-start justify-between gap-3">
				<div>
					<h3 className="font-semibold text-xl">Invoice branding</h3>
					<p className="text-muted-foreground text-sm">
						Your logo and stamp on the invoices you send. The Riaya footer is
						removed.
					</p>
				</div>
				{billing && locked && (
					<Button asChild size="sm" className="gap-1.5">
						<Link href="/dashboard/subscription">
							<Lock className="size-3.5" />
							Upgrade to Pro
						</Link>
					</Button>
				)}
			</div>
			<div className="grid gap-3 sm:grid-cols-2">
				{SLOTS.map((slot) => (
					<BrandingSlot
						key={slot.key}
						title={slot.title}
						hint={slot.hint}
						url={current[slot.key]}
						locked={locked}
						busy={busySlot === slot.key}
						onPick={(file) => pick(slot.key, file)}
						onRemove={() => remove(slot.key)}
					/>
				))}
			</div>
		</section>
	);
}
