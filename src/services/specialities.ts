import api from "./api";
import type { Speciality } from "./types";

export interface SpecialityPayload {
	enName: string;
	frName: string;
	arName: string;
	slug?: string;
}

// ─── GET /api/specialities ────────────────────────────────────────────────────

export async function getSpecialities(): Promise<Speciality[]> {
	const { data } = await api.get<Speciality[]>("/api/specialities");
	return data;
}

// ─── POST /api/specialities ───────────────────────────────────────────────────
// Admin-only

export async function createSpeciality(
	payload: SpecialityPayload,
): Promise<Speciality> {
	const { data } = await api.post<Speciality>("/api/specialities", payload);
	return data;
}

// ─── PUT /api/specialities ────────────────────────────────────────────────────
// Admin-only

export async function updateSpeciality(
	id: number,
	payload: SpecialityPayload,
): Promise<Speciality> {
	const { data } = await api.put<Speciality>("/api/specialities", {
		id,
		...payload,
	});
	return data;
}

// ─── DELETE /api/specialities ─────────────────────────────────────────────────
// Admin-only. Doctors with this speciality are reassigned to newSpecialityId.

export async function deleteSpeciality(
	id: number,
	newSpecialityId: number,
): Promise<{ message: string }> {
	const { data } = await api.delete<{ message: string }>("/api/specialities", {
		params: { id, newSpecialityId },
	});
	return data;
}
