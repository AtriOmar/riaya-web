import api from "./api";
import type { BestFitDoctor } from "./types";

// ─── GET /api/doctors/best-fit ────────────────────────────────────────────────

export interface GetBestFitDoctorsParams {
	speciality: string;
	long: number;
	lat: number;
	time?: string; // ISO datetime — desired appointment time
}

export async function getBestFitDoctors(
	params: GetBestFitDoctorsParams,
): Promise<BestFitDoctor[]> {
	const { data } = await api.get<BestFitDoctor[]>("/api/doctors/best-fit", {
		params,
	});
	return data;
}
