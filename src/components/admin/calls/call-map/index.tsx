"use client";

import {
	CalendarCheck,
	ChevronDown,
	MapPin,
	Stethoscope,
	UserRound,
} from "lucide-react";
import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { CubeLoader } from "@/components/loaders";
import type { CallData } from "@/hooks/use-realtime-socket";
import { cn } from "@/lib/utils";
import { useGetApiDoctorsBestFitMap } from "@/services/generated/doctors/doctors";
import { useGetApiSpecialities } from "@/services/generated/miscellaneous/miscellaneous";
import { type CallJourney, getCallJourney } from "../call-journey";
import type { MapDoctor } from "./map-inner";

const CallMapInner = dynamic(() => import("./map-inner"), {
	ssr: false,
	loading: () => (
		<div className="flex h-full items-center justify-center bg-muted/30">
			<CubeLoader />
		</div>
	),
});

type Step = {
	key: string;
	icon: typeof MapPin;
	label: string;
	value: string | null;
	/** Shown while the step has no value. */
	pending: string;
};

function locationValue(journey: CallJourney) {
	const { patient, candidates } = journey;
	if (patient) {
		return (
			patient.label ?? `${patient.lat.toFixed(4)}, ${patient.lng.toFixed(4)}`
		);
	}
	if (candidates.length > 1) return `${candidates.length} possible places`;
	return null;
}

function bookingValue(
	journey: CallJourney,
	nameOf: (id: number) => string | null,
) {
	const { booking } = journey;
	if (!booking) return null;
	if (booking.urgent) {
		const n = booking.doctorIds.length;
		return `Urgent, ${n} doctor${n === 1 ? "" : "s"} asked`;
	}
	const id = booking.doctorIds[0];
	return (id != null && nameOf(id)) || "Booked";
}

function Steps({
	steps,
	isActive,
	mapOpen,
	onToggleMap,
	canShowMap,
}: {
	steps: Step[];
	isActive: boolean;
	mapOpen: boolean;
	onToggleMap: () => void;
	canShowMap: boolean;
}) {
	// The first step without a value is the one the call is on.
	const current = isActive ? steps.findIndex((s) => !s.value) : -1;

	return (
		<div className="flex items-stretch gap-1">
			<ol className="grid min-w-0 flex-1 grid-cols-4 gap-1">
				{steps.map((step, i) => {
					const done = Boolean(step.value);
					const Icon = step.icon;
					return (
						<li
							key={step.key}
							className={cn(
								"min-w-0 rounded-md border px-2 py-1.5",
								done
									? "border-primary/25 bg-primary/5"
									: "border-dashed bg-transparent",
							)}
						>
							<div className="flex items-center gap-1.5">
								<Icon
									className={cn(
										"size-3.5 shrink-0",
										done ? "text-primary" : "text-muted-foreground",
										i === current && "animate-pulse",
									)}
								/>
								<span className="truncate font-medium text-[10px] text-muted-foreground uppercase tracking-wide">
									{step.label}
								</span>
							</div>
							<p
								dir="auto"
								title={step.value ?? undefined}
								className={cn(
									"mt-0.5 truncate text-xs",
									done
										? "font-medium text-foreground"
										: "text-muted-foreground",
								)}
							>
								{step.value ?? (isActive ? step.pending : "—")}
							</p>
						</li>
					);
				})}
			</ol>
			{canShowMap && (
				<button
					type="button"
					onClick={onToggleMap}
					className="flex shrink-0 items-center gap-1 rounded-md px-1.5 text-muted-foreground text-xs hover:bg-muted hover:text-foreground"
					title={mapOpen ? "Hide map" : "Show map"}
				>
					<MapPin className="size-3.5" />
					<ChevronDown
						className={cn(
							"size-3.5 transition-transform",
							mapOpen && "rotate-180",
						)}
					/>
				</button>
			)}
		</div>
	);
}

/**
 * Where the call stands (location, speciality, doctors offered, booking) and a
 * map of it: the patient, the places the AI hesitated between, every doctor of
 * the speciality, the ones offered and the one booked. Built from the call's
 * tool calls, so it fills in live and works the same for past calls.
 */
export default function CallMap({
	call,
	className,
}: {
	call: CallData;
	className?: string;
}) {
	const isActive = call.status === "active";
	const journey = useMemo(() => getCallJourney(call.timeline), [call.timeline]);
	const slug = journey.specialitySlug;
	const [mapOpen, setMapOpen] = useState(true);

	const { data: specialities } = useGetApiSpecialities({
		swr: { revalidateOnFocus: false },
	});
	// Every doctor of the speciality, nationwide, so far fallbacks show too.
	const { data: specialityDoctors, isLoading: doctorsLoading } =
		useGetApiDoctorsBestFitMap(slug ? { speciality: slug } : undefined, {
			swr: { enabled: Boolean(slug), revalidateOnFocus: false },
		});

	const doctors = useMemo<MapDoctor[]>(
		() =>
			(specialityDoctors ?? []).flatMap((d) =>
				d.cabinetLatitude != null && d.cabinetLongitude != null
					? [
							{
								id: d.id,
								name: `Dr. ${[d.firstName, d.lastName].filter(Boolean).join(" ")}`,
								cabinet: d.cabinetName,
								lat: d.cabinetLatitude,
								lng: d.cabinetLongitude,
							},
						]
					: [],
			),
		[specialityDoctors],
	);

	const specialityName = slug
		? (specialities?.find((s) => s.slug === slug)?.enName ?? slug)
		: null;

	const nameOf = (id: number) =>
		journey.offered.find((d) => d.id === id)?.name ??
		doctors.find((d) => d.id === id)?.name ??
		null;

	const offeredCount = journey.offered.length;
	const steps: Step[] = [
		{
			key: "location",
			icon: MapPin,
			label: "Location",
			value: locationValue(journey),
			pending: "Not known yet",
		},
		{
			key: "speciality",
			icon: Stethoscope,
			label: "Speciality",
			value: specialityName,
			pending: "Not known yet",
		},
		{
			key: "offered",
			icon: UserRound,
			label: "Offered",
			value:
				offeredCount > 0
					? `${offeredCount} doctor${offeredCount === 1 ? "" : "s"}`
					: null,
			pending: "None yet",
		},
		{
			key: "booking",
			icon: CalendarCheck,
			label: "Booked",
			value: bookingValue(journey, nameOf),
			pending: "Not yet",
		},
	];

	const canShowMap = Boolean(
		journey.patient || journey.candidates.length > 0 || slug,
	);
	// A past call that never got anywhere has nothing to show.
	if (!isActive && !canShowMap) return null;

	return (
		<div className={cn("space-y-2", className)}>
			<Steps
				steps={steps}
				isActive={isActive}
				mapOpen={mapOpen}
				onToggleMap={() => setMapOpen((o) => !o)}
				canShowMap={canShowMap}
			/>
			{canShowMap && mapOpen && (
				<div className="relative isolate z-0 h-64 overflow-hidden rounded-lg border">
					<CallMapInner
						journey={journey}
						doctors={doctors}
						specialityName={specialityName}
						doctorsLoading={doctorsLoading}
					/>
				</div>
			)}
		</div>
	);
}
