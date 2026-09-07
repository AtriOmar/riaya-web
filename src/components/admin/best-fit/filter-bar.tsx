"use client";

import { Check, ChevronsUpDown, MapPin, Stethoscope } from "lucide-react";
import { useMemo, useState } from "react";
import LocationPickerDialog from "@/components/admin/best-fit/location-picker-dialog";
import LocationPreview from "@/components/admin/best-fit/location-preview";
import { Button } from "@/components/ui/button";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@/components/ui/command";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type {
	GetApiCities200Item,
	GetApiSpecialities200Item,
} from "@/services/generated/api.schemas";
import {
	useGetApiCities,
	useGetApiSpecialities,
} from "@/services/generated/miscellaneous/miscellaneous";

export type BestFitFilters = {
	specialityId: number | null;
	specialitySlug: string | null;
	cityId: number | null;
	lat: number | null;
	long: number | null;
};

type Props = {
	filters: BestFitFilters;
	onChange: (next: BestFitFilters) => void;
};

function formatCoords(lat: number, lng: number) {
	return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
}

export default function BestFitFilterBar({ filters, onChange }: Props) {
	const { data: specialities, isLoading: specialitiesLoading } =
		useGetApiSpecialities();
	const { data: cities, isLoading: citiesLoading } = useGetApiCities();

	const [specOpen, setSpecOpen] = useState(false);
	const [cityOpen, setCityOpen] = useState(false);
	const [mapOpen, setMapOpen] = useState(false);

	const specialityList = useMemo(() => specialities ?? [], [specialities]);
	const cityList = useMemo(
		() =>
			(cities ?? []).filter((c) => c.latitude != null && c.longitude != null),
		[cities],
	);

	const selectedSpec = specialityList.find(
		(s) => s.id === filters.specialityId,
	);
	const selectedCity = cityList.find((c) => c.id === filters.cityId);

	const hasCustomPin = filters.lat != null && filters.long != null;
	const pinMatchesCity =
		selectedCity?.latitude != null &&
		selectedCity?.longitude != null &&
		filters.lat != null &&
		filters.long != null &&
		Math.abs(selectedCity.latitude - filters.lat) < 1e-5 &&
		Math.abs(selectedCity.longitude - filters.long) < 1e-5;

	function selectSpeciality(s: GetApiSpecialities200Item) {
		onChange({
			...filters,
			specialityId: s.id,
			specialitySlug: s.slug ?? s.enName ?? null,
		});
		setSpecOpen(false);
	}

	function selectCity(c: GetApiCities200Item) {
		if (c.latitude == null || c.longitude == null) return;
		onChange({
			...filters,
			cityId: c.id,
			lat: c.latitude,
			long: c.longitude,
		});
		setCityOpen(false);
	}

	function confirmMapPin(lat: number, lng: number) {
		onChange({
			...filters,
			lat,
			long: lng,
		});
	}

	const locationLabel = hasCustomPin
		? pinMatchesCity && selectedCity
			? (selectedCity.enName ??
				selectedCity.frName ??
				selectedCity.slug ??
				formatCoords(filters.lat as number, filters.long as number))
			: selectedCity
				? `${selectedCity.enName ?? selectedCity.frName ?? "City"} · pin`
				: formatCoords(filters.lat as number, filters.long as number)
		: citiesLoading
			? "Loading…"
			: "Select city or pin";

	const mapCenter =
		filters.lat != null && filters.long != null
			? { lat: filters.lat, lng: filters.long }
			: selectedCity?.latitude != null && selectedCity?.longitude != null
				? { lat: selectedCity.latitude, lng: selectedCity.longitude }
				: null;

	return (
		<>
			<div className="flex flex-wrap items-center gap-3 p-4 border rounded-xl bg-card">
				{/* Speciality */}
				<div className="flex flex-col gap-1.5">
					<label
						htmlFor="best-fit-speciality"
						className="text-xs font-medium text-muted-foreground"
					>
						Speciality
					</label>
					<Popover open={specOpen} onOpenChange={setSpecOpen}>
						<PopoverTrigger asChild>
							<Button
								id="best-fit-speciality"
								variant="quiet"
								role="combobox"
								aria-expanded={specOpen}
								className="justify-between w-[240px] h-10 font-normal"
							>
								<span className="inline-flex items-center gap-2 truncate">
									<Stethoscope className="w-4 h-4 shrink-0" />
									<span className="truncate">
										{selectedSpec
											? (selectedSpec.enName ??
												selectedSpec.frName ??
												selectedSpec.slug)
											: specialitiesLoading
												? "Loading…"
												: "Select speciality"}
									</span>
								</span>
								<ChevronsUpDown className="w-4 h-4 opacity-50 shrink-0" />
							</Button>
						</PopoverTrigger>
						<PopoverContent className="w-[280px] p-0" align="start">
							<Command>
								<CommandInput placeholder="Search speciality…" />
								<CommandList>
									<CommandEmpty>No speciality found.</CommandEmpty>
									<CommandGroup>
										{specialityList.map((s) => (
											<CommandItem
												key={s.id}
												value={`${s.enName ?? ""} ${s.frName ?? ""} ${s.arName ?? ""} ${s.slug ?? ""}`}
												onSelect={() => selectSpeciality(s)}
											>
												<Check
													className={cn(
														"w-4 h-4",
														filters.specialityId === s.id
															? "opacity-100"
															: "opacity-0",
													)}
												/>
												<span className="truncate">
													{s.enName ?? s.frName ?? s.slug ?? "—"}
												</span>
											</CommandItem>
										))}
									</CommandGroup>
								</CommandList>
							</Command>
						</PopoverContent>
					</Popover>
					{/* Matches the coords line under patient location */}
					{hasCustomPin ? <div className="h-4" aria-hidden /> : null}
				</div>

				{/* City + map preview */}
				<div className="flex items-center gap-3">
					<div className="flex flex-col gap-1.5">
						<label
							htmlFor="best-fit-city"
							className="text-xs font-medium text-muted-foreground"
						>
							Patient location
						</label>
						<Popover open={cityOpen} onOpenChange={setCityOpen}>
							<PopoverTrigger asChild>
								<Button
									id="best-fit-city"
									variant="quiet"
									role="combobox"
									aria-expanded={cityOpen}
									className="justify-between w-[220px] h-10 font-normal"
								>
									<span className="inline-flex items-center gap-2 truncate">
										<MapPin className="w-4 h-4 shrink-0" />
										<span className="truncate">{locationLabel}</span>
									</span>
									<ChevronsUpDown className="w-4 h-4 opacity-50 shrink-0" />
								</Button>
							</PopoverTrigger>
							<PopoverContent className="w-[280px] p-0" align="start">
								<Command>
									<CommandInput placeholder="Search city…" />
									<CommandList>
										<CommandEmpty>No city found.</CommandEmpty>
										<CommandGroup>
											{cityList.map((c) => (
												<CommandItem
													key={c.id}
													value={`${c.enName ?? ""} ${c.frName ?? ""} ${c.arName ?? ""} ${c.slug ?? ""}`}
													onSelect={() => selectCity(c)}
												>
													<Check
														className={cn(
															"w-4 h-4",
															filters.cityId === c.id && pinMatchesCity
																? "opacity-100"
																: "opacity-0",
														)}
													/>
													<span className="truncate">
														{c.enName ?? c.frName ?? c.slug ?? "—"}
													</span>
												</CommandItem>
											))}
										</CommandGroup>
									</CommandList>
								</Command>
							</PopoverContent>
						</Popover>
						{hasCustomPin && (
							<p className="h-4 text-[11px] leading-4 text-muted-foreground tabular-nums">
								{formatCoords(filters.lat as number, filters.long as number)}
								{!pinMatchesCity ? " · custom pin" : ""}
							</p>
						)}
					</div>

					<LocationPreview
						lat={filters.lat}
						lng={filters.long}
						onClick={() => setMapOpen(true)}
					/>
				</div>

				{/* Info */}
				<div className="ml-auto text-xs text-muted-foreground max-w-xs text-right">
					{filters.specialityId && hasCustomPin ? (
						<span>
							Top best-fit doctors near this pin. Click a day for the full day
							calendar.
						</span>
					) : (
						<span>
							Select a speciality and a location (city or map pin) to load the
							calendar.
						</span>
					)}
				</div>
			</div>

			<LocationPickerDialog
				open={mapOpen}
				onOpenChange={setMapOpen}
				value={
					filters.lat != null && filters.long != null
						? { lat: filters.lat, lng: filters.long }
						: null
				}
				initialCenter={mapCenter}
				onConfirm={confirmMapPin}
			/>
		</>
	);
}
