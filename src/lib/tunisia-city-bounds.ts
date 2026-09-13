export type GeoPoint = {
	lat: number;
	lng: number;
};

export type CityBounds = {
	minLat: number;
	maxLat: number;
	minLng: number;
	maxLng: number;
};

/** Urban bounding boxes for Tunisian governorate capitals, kept on land. */
export const CITY_BOUNDS: Record<string, CityBounds> = {
	tunis: { minLat: 36.78, maxLat: 36.86, minLng: 10.14, maxLng: 10.25 },
	sfax: { minLat: 34.71, maxLat: 34.81, minLng: 10.7, maxLng: 10.8 },
	sousse: { minLat: 35.8, maxLat: 35.86, minLng: 10.59, maxLng: 10.64 },
	nabeul: { minLat: 36.44, maxLat: 36.48, minLng: 10.7, maxLng: 10.75 },
	ben_arous: { minLat: 36.72, maxLat: 36.77, minLng: 10.2, maxLng: 10.27 },
	ariana: { minLat: 36.84, maxLat: 36.88, minLng: 10.16, maxLng: 10.22 },
	bizerte: { minLat: 37.26, maxLat: 37.29, minLng: 9.85, maxLng: 9.89 },
	medenine: { minLat: 33.33, maxLat: 33.38, minLng: 10.48, maxLng: 10.53 },
	gabes: { minLat: 33.86, maxLat: 33.91, minLng: 10.08, maxLng: 10.12 },
	monastir: { minLat: 35.75, maxLat: 35.79, minLng: 10.8, maxLng: 10.84 },
	kairouan: { minLat: 35.65, maxLat: 35.7, minLng: 10.08, maxLng: 10.13 },
	beja: { minLat: 36.71, maxLat: 36.75, minLng: 9.16, maxLng: 9.2 },
	mahdia: { minLat: 35.49, maxLat: 35.52, minLng: 11.04, maxLng: 11.07 },
	le_kef: { minLat: 36.16, maxLat: 36.19, minLng: 8.69, maxLng: 8.73 },
	manouba: { minLat: 36.8, maxLat: 36.83, minLng: 10.07, maxLng: 10.12 },
	kasserine: { minLat: 35.15, maxLat: 35.19, minLng: 8.81, maxLng: 8.85 },
	gafsa: { minLat: 34.4, maxLat: 34.45, minLng: 8.76, maxLng: 8.81 },
	jendouba: { minLat: 36.48, maxLat: 36.52, minLng: 8.76, maxLng: 8.8 },
	sidi_bouzid: { minLat: 35.02, maxLat: 35.06, minLng: 9.47, maxLng: 9.51 },
	zaghouan: { minLat: 36.39, maxLat: 36.42, minLng: 10.13, maxLng: 10.16 },
	tataouine: { minLat: 32.91, maxLat: 32.95, minLng: 10.43, maxLng: 10.47 },
	siliana: { minLat: 36.07, maxLat: 36.1, minLng: 9.35, maxLng: 9.39 },
	kebili: { minLat: 33.69, maxLat: 33.72, minLng: 8.96, maxLng: 9.0 },
	tozeur: { minLat: 33.91, maxLat: 33.93, minLng: 8.12, maxLng: 8.15 },
};

function roundCoord(value: number) {
	return Number(value.toFixed(6));
}

function distanceMeters(a: GeoPoint, b: GeoPoint) {
	const toRad = (deg: number) => (deg * Math.PI) / 180;
	const earthRadius = 6371000;
	const dLat = toRad(b.lat - a.lat);
	const dLng = toRad(b.lng - a.lng);
	const lat1 = toRad(a.lat);
	const lat2 = toRad(b.lat);
	const h =
		Math.sin(dLat / 2) ** 2 +
		Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
	return 2 * earthRadius * Math.asin(Math.sqrt(h));
}

function randomInRange(min: number, max: number) {
	return min + Math.random() * (max - min);
}

export function hasCityBounds(slug: string | null | undefined) {
	return Boolean(slug && CITY_BOUNDS[slug]);
}

export function randomPointInCityBounds(
	slug: string,
	occupied: GeoPoint[],
	minDistanceMeters = 80,
): GeoPoint {
	const bounds = CITY_BOUNDS[slug];
	if (!bounds) {
		throw new Error(`No urban bounds defined for city "${slug}"`);
	}

	let lastPoint: GeoPoint = {
		lat: roundCoord((bounds.minLat + bounds.maxLat) / 2),
		lng: roundCoord((bounds.minLng + bounds.maxLng) / 2),
	};

	for (let attempt = 0; attempt < 250; attempt++) {
		const point = {
			lat: roundCoord(randomInRange(bounds.minLat, bounds.maxLat)),
			lng: roundCoord(randomInRange(bounds.minLng, bounds.maxLng)),
		};
		lastPoint = point;

		const tooClose = occupied.some(
			(other) => distanceMeters(point, other) < minDistanceMeters,
		);
		if (!tooClose) {
			return point;
		}
	}

	return lastPoint;
}

export class CityLocationAllocator {
	private occupiedByCity = new Map<string, GeoPoint[]>();

	next(slug: string, minDistanceMeters = 80): GeoPoint {
		const occupied = this.occupiedByCity.get(slug) ?? [];
		const point = randomPointInCityBounds(slug, occupied, minDistanceMeters);
		occupied.push(point);
		this.occupiedByCity.set(slug, occupied);
		return point;
	}
}
