"use client";

import moment from "moment";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import BestFitCalendar from "@/components/admin/best-fit/best-fit-calendar";
import DayCalendar from "@/components/admin/best-fit/day-calendar";
import DoctorsMap from "@/components/admin/best-fit/doctors-map";
import BestFitFilterBar, {
	type BestFitFilters,
} from "@/components/admin/best-fit/filter-bar";
import AdminLayout from "@/components/layouts/admin-layout";
import type { BestFitRangeDoctor } from "@/hooks/use-best-fit-range";
import { useBestFitRange } from "@/hooks/use-best-fit-range";
import {
	useGetApiCities,
	useGetApiSpecialities,
} from "@/services/generated/miscellaneous/miscellaneous";

function toDateOnly(d: Date): string {
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, "0");
	const day = String(d.getDate()).padStart(2, "0");
	return `${y}-${m}-${day}`;
}

function weekWindow(anchor: Date) {
	const start = moment(anchor).startOf("week").toDate();
	start.setHours(0, 0, 0, 0);
	const end = moment(anchor).endOf("week").toDate();
	end.setHours(23, 59, 59, 999);
	return { start, end };
}

function parseDateOnly(dateStr: string | null): Date | null {
	if (!dateStr) return null;
	const [y, m, d] = dateStr.split("-").map(Number);
	if (!y || !m || !d) return null;
	return new Date(y, m - 1, d, 0, 0, 0, 0);
}

function parseCoord(value: string | null): number | null {
	if (value == null || value === "") return null;
	const n = Number(value);
	return Number.isFinite(n) ? n : null;
}

export default function AdminBestFitPage() {
	const router = useRouter();
	const searchParams = useSearchParams();

	const urlSpecialityId = searchParams.get("specialityId");
	const urlCityId = searchParams.get("cityId");
	const urlLat = searchParams.get("lat");
	const urlLong = searchParams.get("long");
	const urlDay = searchParams.get("day");
	const urlView = searchParams.get("view");

	const [currentDate, setCurrentDate] = useState(() => {
		const day = parseDateOnly(urlDay);
		return day ?? new Date();
	});

	const viewMode: "calendar" | "map" = urlView === "map" ? "map" : "calendar";

	const { data: specialities } = useGetApiSpecialities();
	const { data: cities } = useGetApiCities();

	const filters: BestFitFilters = useMemo(() => {
		const specId = urlSpecialityId ? Number(urlSpecialityId) : null;
		const cityId = urlCityId ? Number(urlCityId) : null;
		const spec = specialities?.find((s) => s.id === specId);
		const city = cities?.find((c) => c.id === cityId);

		const latFromUrl = parseCoord(urlLat);
		const longFromUrl = parseCoord(urlLong);

		return {
			specialityId: spec?.id ?? null,
			specialitySlug: spec?.slug ?? spec?.enName ?? null,
			cityId: city?.id ?? null,
			lat: latFromUrl ?? city?.latitude ?? null,
			long: longFromUrl ?? city?.longitude ?? null,
		};
	}, [urlSpecialityId, urlCityId, urlLat, urlLong, specialities, cities]);

	const updateUrl = useCallback(
		(
			next: Partial<{
				specialityId: number | null;
				cityId: number | null;
				lat: number | null;
				long: number | null;
				day: string | null;
				view: "calendar" | "map" | null;
			}>,
		) => {
			const p = new URLSearchParams(searchParams.toString());
			if ("specialityId" in next) {
				if (next.specialityId == null) p.delete("specialityId");
				else p.set("specialityId", String(next.specialityId));
			}
			if ("cityId" in next) {
				if (next.cityId == null) p.delete("cityId");
				else p.set("cityId", String(next.cityId));
			}
			if ("lat" in next) {
				if (next.lat == null) p.delete("lat");
				else p.set("lat", String(next.lat));
			}
			if ("long" in next) {
				if (next.long == null) p.delete("long");
				else p.set("long", String(next.long));
			}
			if ("day" in next) {
				if (!next.day) p.delete("day");
				else p.set("day", next.day);
			}
			if ("view" in next) {
				if (!next.view || next.view === "calendar") p.delete("view");
				else p.set("view", next.view);
			}
			router.replace(`?${p.toString()}`, { scroll: false });
		},
		[router, searchParams],
	);

	function handleFiltersChange(next: BestFitFilters) {
		updateUrl({
			specialityId: next.specialityId,
			cityId: next.cityId,
			lat: next.lat,
			long: next.long,
		});
	}

	const selectedDay = parseDateOnly(urlDay);

	const rangeAnchor = selectedDay ?? currentDate;
	const { start, end } = useMemo(() => weekWindow(rangeAnchor), [rangeAnchor]);
	const filtersReady =
		filters.specialitySlug != null &&
		filters.lat != null &&
		filters.long != null;

	const rangeParams = filtersReady
		? {
				speciality: filters.specialitySlug as string,
				lat: filters.lat as number,
				long: filters.long as number,
				from: start.toISOString(),
				to: end.toISOString(),
			}
		: null;

	const { data, isLoading } = useBestFitRange(rangeParams);

	const selectedDayDoctors = useMemo(() => {
		if (!selectedDay || !data) return [];
		const key = toDateOnly(selectedDay);
		return data.find((d) => d.date === key)?.doctors ?? [];
	}, [selectedDay, data]);

	const mapDoctors: BestFitRangeDoctor[] = useMemo(() => {
		if (selectedDay) return selectedDayDoctors;
		if (!data) return [];
		return data.flatMap((d) => d.doctors);
	}, [selectedDay, selectedDayDoctors, data]);

	const mapScopeLabel = useMemo(() => {
		if (selectedDay) {
			return selectedDay.toLocaleDateString("en-GB", {
				weekday: "short",
				day: "2-digit",
				month: "short",
			});
		}
		return "this week";
	}, [selectedDay]);

	const scheduleDate = selectedDay ?? currentDate;

	function openDay(date: Date) {
		setCurrentDate(date);
		updateUrl({ day: toDateOnly(date) });
	}

	function closeDay() {
		updateUrl({ day: null });
	}

	function navigateDay(date: Date) {
		setCurrentDate(date);
		updateUrl({ day: toDateOnly(date) });
	}

	function goToDoctor(doctorId: number, date: Date) {
		const params = new URLSearchParams();
		params.set("from", toDateOnly(date));
		if (filters.specialityId)
			params.set("specialityId", String(filters.specialityId));
		if (filters.cityId) params.set("cityId", String(filters.cityId));
		if (filters.lat != null) params.set("lat", String(filters.lat));
		if (filters.long != null) params.set("long", String(filters.long));
		if (viewMode === "map") params.set("view", "map");
		router.push(`/admin/best-fit/doctor/${doctorId}?${params.toString()}`);
	}

	return (
		<AdminLayout title="Best Fit Finder">
			<BestFitFilterBar
				filters={filters}
				onChange={handleFiltersChange}
				viewMode={viewMode}
				onViewChange={(next) => updateUrl({ view: next })}
			/>

			{viewMode === "map" ? (
				<DoctorsMap
					patient={
						filters.lat != null && filters.long != null
							? { lat: filters.lat, lng: filters.long }
							: null
					}
					doctors={mapDoctors}
					isLoading={isLoading}
					filtersReady={filtersReady}
					scopeLabel={mapScopeLabel}
					onSelectDoctor={(id) => goToDoctor(id, scheduleDate)}
				/>
			) : selectedDay ? (
				<DayCalendar
					key={toDateOnly(selectedDay)}
					date={selectedDay}
					doctors={selectedDayDoctors}
					isLoading={isLoading}
					onBack={closeDay}
					onNavigateDay={navigateDay}
					onSelectDoctor={goToDoctor}
				/>
			) : (
				<BestFitCalendar
					data={data}
					isLoading={isLoading}
					filtersReady={filtersReady}
					currentDate={currentDate}
					onNavigate={setCurrentDate}
					onSelectDate={openDay}
					onSelectDoctor={goToDoctor}
				/>
			)}
		</AdminLayout>
	);
}
