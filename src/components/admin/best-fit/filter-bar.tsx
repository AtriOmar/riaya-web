"use client";

import { Check, ChevronsUpDown, MapPin, Stethoscope } from "lucide-react";
import { useMemo, useState } from "react";
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

export default function BestFitFilterBar({ filters, onChange }: Props) {
	const { data: specialities, isLoading: specialitiesLoading } =
		useGetApiSpecialities();
	const { data: cities, isLoading: citiesLoading } = useGetApiCities();

	const [specOpen, setSpecOpen] = useState(false);
	const [cityOpen, setCityOpen] = useState(false);

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

	return (
		<div className="flex flex-wrap items-end gap-3 p-4 border rounded-xl bg-card">
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
			</div>

			{/* City / Location */}
			<div className="flex flex-col gap-1.5">
				<label
					htmlFor="best-fit-city"
					className="text-xs font-medium text-muted-foreground"
				>
					Patient location (city)
				</label>
				<Popover open={cityOpen} onOpenChange={setCityOpen}>
					<PopoverTrigger asChild>
						<Button
							id="best-fit-city"
							variant="quiet"
							role="combobox"
							aria-expanded={cityOpen}
							className="justify-between w-[240px] h-10 font-normal"
						>
							<span className="inline-flex items-center gap-2 truncate">
								<MapPin className="w-4 h-4 shrink-0" />
								<span className="truncate">
									{selectedCity
										? (selectedCity.enName ??
											selectedCity.frName ??
											selectedCity.slug)
										: citiesLoading
											? "Loading…"
											: "Select city"}
								</span>
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
													filters.cityId === c.id ? "opacity-100" : "opacity-0",
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
			</div>

			{/* Info */}
			<div className="ml-auto text-xs text-muted-foreground">
				{filters.specialityId && filters.cityId ? (
					<span>
						Top best-fit doctors for this week. Click a day to open the full day
						calendar.
					</span>
				) : (
					<span>Select a speciality and a city to see the calendar.</span>
				)}
			</div>
		</div>
	);
}
