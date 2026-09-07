"use client";

import useSWR from "swr";
import { customInstance } from "@/services/api";
import type { Availability } from "@/services/types";

export type AdminDoctorAppointment = {
	id: number;
	start: string | null;
	end: string | null;
	status: "pending" | "confirmed" | "cancelled" | null;
	name: string | null;
	description: string | null;
	newPatientName: string | null;
};

export type AdminDoctorProfile = {
	id: number;
	userId: string;
	firstName: string | null;
	lastName: string | null;
	cabinetName: string | null;
	address: string | null;
	cabinetLatitude: number | null;
	cabinetLongitude: number | null;
	status: string | null;
	availability: Availability | null;
	speciality: {
		id: number;
		enName: string | null;
		frName: string | null;
		arName: string | null;
		slug: string | null;
	} | null;
	cabinetCity: {
		id: number;
		enName: string | null;
		frName: string | null;
		latitude: number | null;
		longitude: number | null;
	} | null;
};

export type AdminDoctorResponse = {
	doctor: AdminDoctorProfile;
	appointments: AdminDoctorAppointment[];
};

type Params = {
	id: number;
	from?: string;
	to?: string;
};

async function fetchAdminDoctor(params: Params): Promise<AdminDoctorResponse> {
	const { id, ...query } = params;
	return customInstance<AdminDoctorResponse>({
		url: `/api/doctors/${id}`,
		method: "GET",
		params: query,
	});
}

export function useAdminDoctor(params: Params | null) {
	const key = params ? ([`/api/doctors/${params.id}`, params] as const) : null;

	return useSWR<AdminDoctorResponse>(
		key,
		() => fetchAdminDoctor(params as Params),
		{ revalidateOnFocus: false, keepPreviousData: true },
	);
}
