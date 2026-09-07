"use client";

import { MapPin } from "lucide-react";
import dynamic from "next/dynamic";
import { TUNISIA_CENTER } from "@/lib/tunisia-map";
import { cn } from "@/lib/utils";

const CabinetLocationMap = dynamic(
	() =>
		import(
			"@/components/dashboard/profile/doctor-application/cabinet-location-map"
		),
	{
		ssr: false,
		loading: () => (
			<div className="flex size-full items-center justify-center bg-muted/40">
				<MapPin className="size-4 text-muted-foreground/60" />
			</div>
		),
	},
);

type Props = {
	lat: number | null;
	lng: number | null;
	onClick: () => void;
	className?: string;
};

export default function LocationPreview({
	lat,
	lng,
	onClick,
	className,
}: Props) {
	const hasPin = lat != null && lng != null;
	const center = hasPin ? { lat, lng } : TUNISIA_CENTER;

	return (
		<button
			type="button"
			onClick={onClick}
			title={hasPin ? "Edit location on map" : "Pick location on map"}
			aria-label={hasPin ? "Edit location on map" : "Pick location on map"}
			className={cn(
				// isolate + z-0 keeps Leaflet panes (z~600) from stacking above dialogs
				"relative isolate z-0 size-[100px] shrink-0 overflow-hidden rounded-lg border bg-muted/30",
				"transition-colors hover:border-primary/50 hover:ring-2 hover:ring-primary/20",
				"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
				"[&_.leaflet-pane]:!z-[1] [&_.leaflet-control]:!z-[1] [&_.leaflet-top]:!z-[1] [&_.leaflet-bottom]:!z-[1]",
				className,
			)}
		>
			<CabinetLocationMap
				className="size-full h-full rounded-none border-0"
				center={center}
				marker={hasPin ? { lat: lat as number, lng: lng as number } : null}
				interactive={false}
				zoom={hasPin ? 11 : 6}
			/>
			{!hasPin && (
				<span className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-background/55 px-2 text-center">
					<MapPin className="size-4 text-muted-foreground" />
					<span className="text-[10px] font-medium leading-tight text-muted-foreground">
						Pick on map
					</span>
				</span>
			)}
		</button>
	);
}
