"use client";

import L from "leaflet";
import { Loader2, MapPin, Move } from "lucide-react";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useSWRConfig } from "swr";
import { Button } from "@/components/ui/button";
import { getErrorMessage } from "@/lib/error-handling";
import { usePatchApiDoctorsIdLocation } from "@/services/generated/doctors/doctors";
import { fullName } from "../shared/helpers";
import type { MappableDoctor } from "./map-inner";

type Props = {
	doctor: MappableDoctor;
	/** New pin picked on the map, or null while nothing is picked yet. */
	draft: { lat: number; lng: number } | null;
	onDone: () => void;
};

/**
 * Bar shown over the map while an admin moves a doctor's pin. Saves only the
 * coordinates; the written address stays the same.
 */
export default function RelocateBar({ doctor, draft, onDone }: Props) {
	const ref = useRef<HTMLDivElement>(null);
	const { mutate } = useSWRConfig();
	const { trigger, isMutating } = usePatchApiDoctorsIdLocation(
		String(doctor.id),
	);

	useEffect(() => {
		if (!ref.current) return;
		L.DomEvent.disableClickPropagation(ref.current);
		L.DomEvent.disableScrollPropagation(ref.current);
	}, []);

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape" && !isMutating) onDone();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [isMutating, onDone]);

	async function save() {
		if (!draft) return;
		try {
			const updated = await trigger({
				latitude: draft.lat,
				longitude: draft.lng,
			});
			// Refresh the best-fit lists so the pin and distances update.
			await mutate(
				(key) => Array.isArray(key) && key[0] === "/api/doctors/best-fit/range",
			);
			toast.success(`Location updated for ${fullName(doctor)}`, {
				description: updated?.cityName
					? `City set to ${updated.cityName}`
					: undefined,
			});
			onDone();
		} catch (e) {
			toast.error(getErrorMessage(e, "Could not update the location"));
		}
	}

	const address = doctor.address?.trim();

	return (
		<div
			ref={ref}
			className="absolute bottom-8 left-1/2 z-[1000] w-[min(calc(100%-1.5rem),36rem)] -translate-x-1/2 rounded-lg bg-popover text-popover-foreground shadow-lg ring-1 ring-foreground/10"
		>
			<div className="flex flex-wrap items-center gap-3 px-3.5 py-2.5">
				<div className="flex min-w-0 flex-1 items-start gap-2.5">
					<Move className="mt-0.5 size-4 shrink-0 text-amber-600" />
					<div className="min-w-0">
						<p className="font-medium text-sm leading-snug">
							Moving {fullName(doctor)}
						</p>
						<p className="text-muted-foreground text-xs">
							{draft
								? "Drag the pin or click again to adjust, then save."
								: "Click the map where the cabinet really is."}
						</p>
						{address && (
							<p className="mt-0.5 flex items-center gap-1 text-muted-foreground text-xs">
								<MapPin className="size-3 shrink-0" />
								<span className="truncate">Address kept: {address}</span>
							</p>
						)}
					</div>
				</div>
				<div className="flex shrink-0 gap-2">
					<Button
						size="sm"
						variant="outline"
						disabled={isMutating}
						onClick={onDone}
					>
						Cancel
					</Button>
					<Button size="sm" disabled={!draft || isMutating} onClick={save}>
						{isMutating && <Loader2 className="size-3.5 animate-spin" />}
						Save location
					</Button>
				</div>
			</div>
		</div>
	);
}
