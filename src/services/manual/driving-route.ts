import { customInstance } from "@/services/api";

// Direct Geoapify call (no proxy): the key is the same public key already used
// for address search, so there is no secret to hide.

export type DrivingRoute = {
	/** Polyline(s) as [lat, lng] pairs, ready for Leaflet. */
	lines: [number, number][][];
	distanceKm: number;
	minutes: number;
};

type RoutingResponse = {
	features?: {
		geometry: { type: string; coordinates: number[][][] | number[][] };
		properties: { distance: number; time: number };
	}[];
};

export async function getDrivingRoute(
	from: { lat: number; lng: number },
	to: { lat: number; lng: number },
): Promise<DrivingRoute | null> {
	const apiKey = process.env.NEXT_PUBLIC_GEOAPIFY_API_KEY;
	if (!apiKey) return null;

	const data = await customInstance<RoutingResponse>({
		url: "https://api.geoapify.com/v1/routing",
		method: "GET",
		params: {
			waypoints: `${from.lat},${from.lng}|${to.lat},${to.lng}`,
			mode: "drive",
			apiKey,
		},
	});

	const feature = data.features?.[0];
	if (!feature) return null;

	const raw = feature.geometry.coordinates;
	const parts = (
		feature.geometry.type === "MultiLineString" ? raw : [raw]
	) as number[][][];

	return {
		lines: parts.map((line) =>
			line.map(([lng, lat]) => [lat, lng] as [number, number]),
		),
		distanceKm: feature.properties.distance / 1000,
		minutes: feature.properties.time / 60,
	};
}
