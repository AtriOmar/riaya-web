"use client";

import { CalendarDays, CalendarX, Map as MapIcon } from "lucide-react";
import dynamic from "next/dynamic";
import { useMemo } from "react";
import { CubeLoader } from "@/components/loaders";
import { FilterSegmented } from "@/components/ui/filter-controls";
import type { BestFitMapDoctor } from "@/hooks/use-best-fit-range";
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
	doctors: BestFitMapDoctor[];
	isLoading?: boolean;
	/** Where "View schedule" leads for a doctor. */
	getDoctorHref: (doctorId: number) => string;
};

/** Deduplicate doctors keeping the best (lowest distance) entry and assign ranks. */
export function toMappableDoctors(
	doctors: BestFitMapDoctor[],
): MappableDoctor[] {
	const byId = new Map<number, BestFitMapDoctor>();
	for (const d of doctors) {
		if (d.cabinetLatitude == null || d.cabinetLongitude == null) continue;
		const existing = byId.get(d.id);
		if (
			!existing ||
			(d.distance ?? Number.POSITIVE_INFINITY) <
				(existing.distance ?? Number.POSITIVE_INFINITY)
		) {
			byId.set(d.id, d);
		}
	}
	return [...byId.values()]
		.sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0))
		.map((d, i) => ({ ...d, rank: i + 1 }));
}

export default function DoctorsMap({
	patient,
	doctors,
	isLoading,
	getDoctorHref,
}: Props) {
	const mappable = useMemo(() => toMappableDoctors(doctors), [doctors]);

	return (
		<div className="relative mt-4">
			{isLoading && (
				<div className="z-10 absolute inset-0 flex justify-center items-center bg-background/60 rounded-xl backdrop-blur-sm">
					<CubeLoader />
				</div>
			)}

			<div className="border rounded-xl overflow-hidden bg-card shadow-sm">
				<div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 border-b bg-card/80">
					<div className="flex items-center gap-2 text-sm">
						<MapIcon className="size-4 text-muted-foreground" />
						<span className="font-semibold text-foreground">
							{patient ? "Doctors near patient" : "Doctors"}
						</span>
						<span className="text-muted-foreground text-xs">
							{mappable.length > 0
								? `${mappable.length} doctor${mappable.length === 1 ? "" : "s"}`
								: ""}
						</span>
					</div>
					<div className="hidden sm:flex items-center gap-3 text-[11px] text-muted-foreground">
						{patient && (
							<span className="flex items-center gap-1.5">
								<span className="inline-block size-3 rounded-[4px] rotate-45 bg-rose-600 border border-white shadow-sm" />
								Patient
							</span>
						)}
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

				<div className="relative isolate z-0 h-[min(70vh,560px)] w-full">
					{mappable.length === 0 && !isLoading ? (
						<div className="flex h-full flex-col items-center justify-center py-16 text-muted-foreground text-center">
							<CalendarX className="mb-3 size-10 opacity-40" />
							<p className="font-semibold text-foreground">No doctors found</p>
							<p className="mt-1 max-w-sm text-sm">
								Try another speciality or location, or adjust your filters.
								Doctors without a cabinet location don't appear on the map.
							</p>
						</div>
					) : (
						<DoctorsMapInner
							patient={patient}
							doctors={mappable}
							getDoctorHref={getDoctorHref}
						/>
					)}
				</div>
			</div>

			{mappable.length > 0 && !isLoading && (
				<p className="mt-2 text-muted-foreground text-xs">
					Hover a doctor to see the driving route from the patient; click for
					details and their schedule. Nearby doctors merge into a numbered
					cluster when zoomed out, and split again when you zoom in.
				</p>
			)}
		</div>
	);
}

/** Calendar ↔ map toggle used on the best-fit page. */
export function BestFitViewToggle({
	value,
	onChange,
}: {
	value: "calendar" | "map";
	onChange: (next: "calendar" | "map") => void;
}) {
	return (
		<FilterSegmented
			value={value}
			onChange={onChange}
			options={[
				{ value: "calendar", label: "Calendar", icon: CalendarDays },
				{ value: "map", label: "Map", icon: MapIcon },
			]}
		/>
	);
}
