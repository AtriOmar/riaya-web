"use client";

import useSWR from "swr";
import { customInstance } from "@/services/api";

export type BestFitRangeSlot = { start: string; end: string };

export type BestFitRangeDoctor = {
	id: number;
	userId: string;
	firstName: string | null;
	lastName: string | null;
	cabinetName: string | null;
	cabinetCityId: number | null;
	cabinetLatitude: number | null;
	cabinetLongitude: number | null;
	specialityId: number | null;
	address: string | null;
	distance: number;
	slots: BestFitRangeSlot[];
};

export type BestFitRangeDay = {
	date: string; // yyyy-MM-dd
	doctors: BestFitRangeDoctor[];
};

type Params = {
	speciality: string;
	lat: number;
	long: number;
	from: string; // ISO date string
	to: string; // ISO date string
};

async function fetchRange(params: Params): Promise<BestFitRangeDay[]> {
	return customInstance<BestFitRangeDay[]>({
		url: "/api/doctors/best-fit/range",
		method: "GET",
		params,
	});
}

export function useBestFitRange(params: Params | null) {
	const key = params
		? (["/api/doctors/best-fit/range", params] as const)
		: null;

	return useSWR<BestFitRangeDay[]>(key, () => fetchRange(params as Params), {
		revalidateOnFocus: false,
		keepPreviousData: true,
	});
}
