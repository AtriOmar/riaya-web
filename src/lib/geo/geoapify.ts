import {
	GEO_TIMEOUT_MS,
	type GeoProvider,
	GeoProviderError,
	type LatLng,
	type PlaceResult,
	ROUTE_TIMEOUT_MS,
	type RouteLeg,
} from "./types";

const BASE = "https://api.geoapify.com/v1/geocode";
const ROUTE_MATRIX = "https://api.geoapify.com/v1/routematrix";

type RouteMatrixResponse = {
	sources_to_targets?: {
		distance?: number | null;
		time?: number | null;
	}[][];
};

/** Geoapify Route Matrix: one source row, distances in metres, times in seconds. */
async function driveLegs({
	origin,
	targets,
}: {
	origin: LatLng;
	targets: LatLng[];
}): Promise<RouteLeg[] | null> {
	const key = process.env.GEOAPIFY_API_KEY;
	if (!key || targets.length === 0) return null;
	try {
		const res = await fetch(`${ROUTE_MATRIX}?apiKey=${key}`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				mode: "drive",
				sources: [{ location: [origin.lng, origin.lat] }],
				targets: targets.map((t) => ({ location: [t.lng, t.lat] })),
			}),
			signal: AbortSignal.timeout(ROUTE_TIMEOUT_MS),
		});
		if (!res.ok) return null;
		const row = ((await res.json()) as RouteMatrixResponse)
			.sources_to_targets?.[0];
		if (!row || row.length !== targets.length) return null;
		return row.map((cell) =>
			cell.distance == null || cell.time == null
				? null
				: { distanceKm: cell.distance / 1000, minutes: cell.time / 60 },
		);
	} catch {
		return null;
	}
}

type GeoapifyFeature = {
	properties: {
		place_id?: string;
		formatted?: string;
		lat: number;
		lon: number;
		city?: string;
		state?: string;
		street?: string;
	};
};

function apiKey() {
	const key = process.env.GEOAPIFY_API_KEY;
	if (!key)
		throw new GeoProviderError("GEOAPIFY_API_KEY is not set", "geoapify");
	return key;
}

async function call(
	endpoint: "autocomplete" | "search",
	params: Record<string, string>,
): Promise<PlaceResult[]> {
	const url = new URL(`${BASE}/${endpoint}`);
	url.search = new URLSearchParams({
		...params,
		limit: "5",
		apiKey: apiKey(),
	}).toString();

	const res = await fetch(url, { signal: AbortSignal.timeout(GEO_TIMEOUT_MS) });
	if (!res.ok) {
		throw new GeoProviderError(
			`Geoapify ${endpoint} failed (${res.status})`,
			"geoapify",
		);
	}
	const data = (await res.json()) as { features?: GeoapifyFeature[] };

	return (data.features ?? []).map(({ properties: p }) => ({
		id: p.place_id ?? `${p.lat},${p.lon}`,
		label: p.formatted ?? "",
		lat: p.lat,
		lng: p.lon,
		city: p.city ?? null,
		state: p.state ?? null,
		street: p.street ?? null,
	}));
}

const proximity = (p: LatLng) => `proximity:${p.lng},${p.lat}`;

export const geoapifyProvider: GeoProvider = {
	name: "geoapify",

	autocomplete: ({ text, bias }) =>
		call("autocomplete", {
			text,
			filter: "countrycode:tn",
			...(bias ? { bias: proximity(bias) } : {}),
		}),

	// Geoapify autocomplete already returns coordinates, so nothing to resolve.
	details: async () => null,

	search: ({ text, near, radiusM }) =>
		call("search", {
			text,
			filter:
				near && radiusM
					? `circle:${near.lng},${near.lat},${radiusM}`
					: "countrycode:tn",
			...(near ? { bias: proximity(near) } : {}),
		}),

	driveLegs,
};
