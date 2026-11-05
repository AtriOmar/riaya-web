import type { GetApiCities200Item } from "@/services/generated/api.schemas";

/**
 * The city whose center is closest to a point, or null when no city has
 * coordinates. Matching by position avoids comparing the geocoder's city name
 * with our English, French and Arabic spellings.
 */
export function nearestCity(
	cities: GetApiCities200Item[],
	lat: number,
	lng: number,
): GetApiCities200Item | null {
	// Squared distance in degrees is enough to rank cities inside one country.
	const lngScale = Math.cos((lat * Math.PI) / 180);
	let best: GetApiCities200Item | null = null;
	let bestDistance = Number.POSITIVE_INFINITY;
	for (const city of cities) {
		if (city.latitude == null || city.longitude == null) continue;
		const distance =
			(city.latitude - lat) ** 2 + ((city.longitude - lng) * lngScale) ** 2;
		if (distance < bestDistance) {
			best = city;
			bestDistance = distance;
		}
	}
	return best;
}
