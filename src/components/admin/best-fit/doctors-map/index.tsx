"use client";

import { CalendarDays, Map as MapIcon, MapPin } from "lucide-react";
import dynamic from "next/dynamic";
import { useMemo } from "react";
import { CubeLoader } from "@/components/loaders";
import type { BestFitRangeDoctor } from "@/hooks/use-best-fit-range";
import { cn } from "@/lib/utils";
import type { MappableDoctor } from "./map-inner";

const DoctorsMapInner = dynamic(() => import("./map-inner"), {
	ssr: false,
	loading: () => (
		<div className="flex h-full items-center justify-center bg-muted/30">
			<CubeLoader />
		</div>
	),
});

type Props = {
	patient: { lat: number; lng: number } | null;
	doctors: BestFitRangeDoctor[];
	isLoading?: boolean;
	filtersReady: boolean;
	/** Label for the scope, e.g. "this week" or a date. */
	scopeLabel: string;
	onSelectDoctor: (doctorId: number) => void;
};

/** Deduplicate doctors keeping the best (lowest distance) entry and assign ranks. */
export function toMappableDoctors(
	doctors: BestFitRangeDoctor[],
): MappableDoctor[] {
	const byId = new Map<number, BestFitRangeDoctor>();
	for (const d of doctors) {
		if (d.cabinetLatitude == null || d.cabinetLongitude == null) continue;
		const existing = byId.get(d.id);
		if (!existing || d.distance < existing.distance) {
			byId.set(d.id, d);
		}
	}
	return [...byId.values()]
		.sort((a, b) => a.distance - b.distance)
		.map((d, i) => ({ ...d, rank: i + 1 }));
}

export default function DoctorsMap({
	patient,
	doctors,
	isLoading,
	filtersReady,
	scopeLabel,
	onSelectDoctor,
}: Props) {
	const mappable = useMemo(() => toMappableDoctors(doctors), [doctors]);

	return (
		<div className="relative mt-4">
			{isLoading && (
				<div className="z-10 absolute inset-0 flex justify-center items-center bg-background/60 rounded-xl backdrop-blur-sm">
					<CubeLoader />
				</div>
			)}

			{!filtersReady && !isLoading && (
				<div className="z-10 absolute inset-0 flex flex-col justify-center items-center bg-background/80 rounded-xl backdrop-blur-sm gap-2 text-muted-foreground text-sm min-h-[420px]">
					<MapPin className="size-8 opacity-40" />
					<p>Pick a speciality and a location to see doctors on the map.</p>
				</div>
			)}

			<div
				className={cn(
					"border rounded-xl overflow-hidden bg-card shadow-sm",
					!filtersReady && "min-h-[420px]",
				)}
			>
				<div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 border-b bg-card/80">
					<div className="flex items-center gap-2 text-sm">
						<MapIcon className="size-4 text-muted-foreground" />
						<span className="font-semibold text-foreground">
							Doctors near patient
						</span>
						<span className="text-muted-foreground text-xs">
							{scopeLabel}
							{mappable.length > 0
								? ` · ${mappable.length} doctor${mappable.length === 1 ? "" : "s"}`
								: ""}
						</span>
					</div>
					<div className="hidden sm:flex items-center gap-3 text-[11px] text-muted-foreground">
						<span className="flex items-center gap-1.5">
							<span className="inline-block size-3 rounded-[4px] rotate-45 bg-rose-600 border border-white shadow-sm" />
							Patient
						</span>
						<span className="flex items-center gap-1.5">
							<span className="inline-block size-3 rounded-[4px] rotate-45 bg-teal-700 border border-white shadow-sm" />
							Doctor
						</span>
						<span className="flex items-center gap-1.5">
							<span className="inline-flex size-3.5 items-center justify-center rounded-full bg-teal-700 border border-white text-[8px] font-semibold text-white shadow-sm">
								N
							</span>
							Cluster
						</span>
					</div>
				</div>

				<div className="h-[min(70vh,560px)] w-full">
					{filtersReady && patient ? (
						mappable.length === 0 && !isLoading ? (
							<div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground text-sm">
								<CalendarDays className="size-8 opacity-40" />
								<p>No doctors with a cabinet location in this range.</p>
							</div>
						) : (
							<DoctorsMapInner
								patient={patient}
								doctors={mappable}
								onSelectDoctor={onSelectDoctor}
							/>
						)
					) : (
						<div className="h-full bg-muted/20" />
					)}
				</div>
			</div>

			{filtersReady && !isLoading && (
				<p className="mt-2 text-muted-foreground text-xs">
					Click a doctor marker to open their schedule. Nearby doctors merge
					into a numbered cluster when zoomed out, and split again when you zoom
					in.
				</p>
			)}
		</div>
	);
}

/** Compact calendar ↔ map toggle used on the best-fit page. */
export function BestFitViewToggle({
	value,
	onChange,
}: {
	value: "calendar" | "map";
	onChange: (next: "calendar" | "map") => void;
}) {
	return (
		<div className="inline-flex items-stretch rounded-lg bg-muted/60 p-1">
			<button
				type="button"
				className={cn(
					"inline-flex min-w-[4.5rem] flex-col items-center justify-center gap-1 rounded-md px-3 py-2 text-xs font-medium transition-colors",
					value === "calendar"
						? "bg-background text-foreground shadow-sm"
						: "text-muted-foreground hover:text-foreground",
				)}
				onClick={() => onChange("calendar")}
			>
				<CalendarDays className="size-6" />
				Calendar
			</button>
			<button
				type="button"
				className={cn(
					"inline-flex min-w-[4.5rem] flex-col items-center justify-center gap-1 rounded-md px-3 py-2 text-xs font-medium transition-colors",
					value === "map"
						? "bg-background text-foreground shadow-sm"
						: "text-muted-foreground hover:text-foreground",
				)}
				onClick={() => onChange("map")}
			>
				<MapIcon className="size-6" />
				Map
			</button>
		</div>
	);
}
