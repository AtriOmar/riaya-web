"use client";

import { MapPin, Stethoscope } from "lucide-react";
import { useMemo, useState } from "react";
import { BestFitViewToggle } from "@/components/admin/best-fit/doctors-map";
import LocationPickerDialog from "@/components/admin/best-fit/location-picker-dialog";
import LocationPreview from "@/components/admin/best-fit/location-preview";
import { FilterCombobox } from "@/components/ui/filter-controls";
import { Separator } from "@/components/ui/separator";
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
	viewMode: "calendar" | "map";
	onViewChange: (next: "calendar" | "map") => void;
};

function formatCoords(lat: number, lng: number) {
	return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
}

export default function BestFitFilterBar({
	filters,
	onChange,
	viewMode,
	onViewChange,
}: Props) {
	const { data: specialities, isLoading: specialitiesLoading } =
		useGetApiSpecialities();
	const { data: cities, isLoading: citiesLoading } = useGetApiCities();

	const [mapOpen, setMapOpen] = useState(false);

	const specialityList = useMemo(() => specialities ?? [], [specialities]);
	const cityList = useMemo(
		() =>
			(cities ?? []).filter((c) => c.latitude != null && c.longitude != null),
		[cities],
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
	}

	function selectCity(c: GetApiCities200Item) {
		if (c.latitude == null || c.longitude == null) return;
		onChange({
			...filters,
			cityId: c.id,
			lat: c.latitude,
			long: c.longitude,
		});
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
			: "Patient location";

	const mapCenter =
		filters.lat != null && filters.long != null
			? { lat: filters.lat, lng: filters.long }
			: selectedCity?.latitude != null && selectedCity?.longitude != null
				? { lat: selectedCity.latitude, lng: selectedCity.longitude }
				: null;

	const specialityOptions = specialityList.map((s) => ({
		id: s.id,
		label: s.enName ?? s.frName ?? s.slug ?? "—",
		keywords: `${s.frName ?? ""} ${s.arName ?? ""} ${s.slug ?? ""}`,
	}));
	const cityOptions = cityList.map((c) => ({
		id: c.id,
		label: c.enName ?? c.frName ?? c.slug ?? "—",
		keywords: `${c.frName ?? ""} ${c.arName ?? ""} ${c.slug ?? ""}`,
	}));

	return (
		<>
			<div className="flex flex-wrap items-center gap-2">
				<FilterCombobox
					icon={Stethoscope}
					placeholder="Speciality"
					searchPlaceholder="Search speciality…"
					emptyText="No speciality found."
					options={specialityOptions}
					selectedId={filters.specialityId}
					loading={specialitiesLoading}
					onSelect={(o) => {
						const s = specialityList.find((x) => x.id === o.id);
						if (s) selectSpeciality(s);
					}}
				/>

				<FilterCombobox
					icon={MapPin}
					placeholder="Patient location"
					searchPlaceholder="Search city…"
					emptyText="No city found."
					options={cityOptions}
					selectedId={pinMatchesCity ? filters.cityId : null}
					loading={citiesLoading}
					displayLabel={hasCustomPin ? locationLabel : null}
					onSelect={(o) => {
						const c = cityList.find((x) => x.id === o.id);
						if (c) selectCity(c);
					}}
				/>

				<LocationPreview
					lat={filters.lat}
					lng={filters.long}
					onClick={() => setMapOpen(true)}
					className="h-10 w-16 rounded-md"
				/>

				<Separator orientation="vertical" className="mx-4 hidden sm:block" />

				<BestFitViewToggle value={viewMode} onChange={onViewChange} />
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
