"use client";

import { MapPin } from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { TUNISIA_CENTER } from "@/lib/tunisia-map";

const CabinetLocationMap = dynamic(
	() =>
		import(
			"@/components/dashboard/profile/doctor-application/cabinet-location-map"
		),
	{
		ssr: false,
		loading: () => (
			<div className="flex items-center justify-center h-[420px] border rounded-lg bg-muted/30 text-sm text-muted-foreground">
				Loading map…
			</div>
		),
	},
);

type Props = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** Current committed search position, if any. */
	value: { lat: number; lng: number } | null;
	/** Map center when opening (city or current pin). */
	initialCenter?: { lat: number; lng: number } | null;
	onConfirm: (lat: number, lng: number) => void;
};

export default function LocationPickerDialog({
	open,
	onOpenChange,
	value,
	initialCenter,
	onConfirm,
}: Props) {
	const [draft, setDraft] = useState<{ lat: number; lng: number } | null>(
		value,
	);

	useEffect(() => {
		if (!open) return;
		setDraft(value ?? initialCenter ?? null);
	}, [open, value, initialCenter]);

	const center = draft ?? initialCenter ?? TUNISIA_CENTER;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				className="sm:max-w-2xl p-0 gap-0 overflow-hidden z-[1100]"
				overlayClassName="z-[1100]"
			>
				<DialogHeader className="px-5 pt-5 pb-3">
					<DialogTitle className="inline-flex items-center gap-2">
						<MapPin className="size-4" />
						Pick patient location
					</DialogTitle>
					<DialogDescription>
						Click the map to drop a pin. Best-fit ranking uses distance from
						this point.
					</DialogDescription>
				</DialogHeader>

				<div className="px-5">
					<CabinetLocationMap
						className="h-[420px]"
						center={center}
						marker={draft}
						onMapClick={(lat, lng) => setDraft({ lat, lng })}
					/>
					{draft ? (
						<p className="mt-2 text-xs text-muted-foreground tabular-nums">
							Selected: {draft.lat.toFixed(5)}, {draft.lng.toFixed(5)}
						</p>
					) : (
						<p className="mt-2 text-xs text-muted-foreground">
							No pin yet — click anywhere on the map.
						</p>
					)}
				</div>

				<DialogFooter className="mx-0 mb-0 px-5 py-4 border-t">
					<Button variant="outline" onClick={() => onOpenChange(false)}>
						Cancel
					</Button>
					<Button
						disabled={!draft}
						onClick={() => {
							if (!draft) return;
							onConfirm(draft.lat, draft.lng);
							onOpenChange(false);
						}}
					>
						Use this location
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
