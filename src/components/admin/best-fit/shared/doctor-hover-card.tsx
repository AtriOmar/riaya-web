"use client";

import { Building2, MapPin } from "lucide-react";
import type { ReactElement } from "react";
import {
	HoverCard,
	HoverCardContent,
	HoverCardTrigger,
} from "@/components/ui/hover-card";
import type { BestFitRangeDoctor } from "@/hooks/use-best-fit-range";
import { fullName, initials } from "./helpers";

type Props = {
	doctor: BestFitRangeDoctor;
	children: ReactElement;
};

export default function DoctorHoverCard({ doctor, children }: Props) {
	const name = fullName(doctor);
	const address = doctor.address?.trim() || null;
	const cabinet = doctor.cabinetName?.trim() || null;

	return (
		<HoverCard openDelay={180} closeDelay={80}>
			<HoverCardTrigger asChild>{children}</HoverCardTrigger>
			<HoverCardContent
				side="top"
				align="center"
				sideOffset={8}
				collisionPadding={12}
				className="w-72 p-0"
			>
				<div className="flex items-start gap-3 px-3.5 pt-3 pb-2.5">
					<div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold tracking-wide text-primary">
						{initials(doctor)}
					</div>
					<div className="min-w-0 flex-1">
						<p className="font-semibold text-sm leading-snug text-foreground">
							{name}
						</p>
						{cabinet ? (
							<p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
								<Building2 className="size-3 shrink-0" />
								<span className="truncate">{cabinet}</span>
							</p>
						) : null}
					</div>
				</div>

				<div className="space-y-1.5 border-t px-3.5 py-2.5">
					<p className="flex items-start gap-2 text-sm leading-snug">
						<MapPin className="mt-0.5 size-3.5 shrink-0 text-primary" />
						<span
							className={address ? "text-foreground" : "text-muted-foreground"}
						>
							{address ?? "Address not available"}
						</span>
					</p>
					<p className="pl-[22px] text-xs text-muted-foreground">
						{doctor.distance.toFixed(1)} km from patient
					</p>
				</div>
			</HoverCardContent>
		</HoverCard>
	);
}
