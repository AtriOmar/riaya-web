import api from "./api";
import type { City } from "./types";

export async function getCities(): Promise<City[]> {
	const { data } = await api.get<City[]>("/api/cities");
	return data;
}
