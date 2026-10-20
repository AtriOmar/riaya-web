import {
	GEO_TIMEOUT_MS,
	type GeoProvider,
	GeoProviderError,
	type LatLng,
	type PlaceResult,
} from "./types";

// Google Places API (New). Needs "Places API (New)" enabled on the project.
const BASE = "https://places.googleapis.com/v1";
const LANGUAGE = "fr";
const REGION = "TN";
/** Google caps a bias circle at 50 km. */
const MAX_BIAS_RADIUS_M = 50_000;

type AddressComponent = { longText?: string; types?: string[] };
type GooglePlace = {
	id?: string;
	displayName?: { text?: string };
	formattedAddress?: string;
	location?: { latitude: number; longitude: number };
	addressComponents?: AddressComponent[];
};

function apiKey() {
	const key = process.env.GOOGLE_PLACES_API_KEY;
	if (!key) {
		throw new GeoProviderError("GOOGLE_PLACES_API_KEY is not set", "google");
	}
	return key;
}

async function request<T>(
	path: string,
	init: { method: "GET" | "POST"; body?: unknown; fieldMask?: string },
): Promise<T> {
	const res = await fetch(`${BASE}${path}`, {
		method: init.method,
		headers: {
			"Content-Type": "application/json",
			"X-Goog-Api-Key": apiKey(),
			...(init.fieldMask ? { "X-Goog-FieldMask": init.fieldMask } : {}),
		},
		body: init.body ? JSON.stringify(init.body) : undefined,
		signal: AbortSignal.timeout(GEO_TIMEOUT_MS),
	});
	if (!res.ok) {
		const detail = (await res.text()).slice(0, 200);
		throw new GeoProviderError(
			`Google Places failed (${res.status}): ${detail}`,
			"google",
		);
	}
	return (await res.json()) as T;
}

const component = (p: GooglePlace, type: string) =>
	p.addressComponents?.find((c) => c.types?.includes(type))?.longText ?? null;

function toResult(p: GooglePlace): PlaceResult {
	const name = p.displayName?.text;
	const address = p.formattedAddress ?? "";
	return {
		id: p.id ?? "",
		// Businesses read better as "Clinique X, address".
		label: name && !address.includes(name) ? `${name}, ${address}` : address,
		lat: p.location?.latitude ?? null,
		lng: p.location?.longitude ?? null,
		city: component(p, "locality"),
		state: component(p, "administrative_area_level_1"),
		street: component(p, "route"),
	};
}

const circle = (center: LatLng, radius: number) => ({
	circle: {
		center: { latitude: center.lat, longitude: center.lng },
		radius: Math.min(radius, MAX_BIAS_RADIUS_M),
	},
});

/** Bounding box for a radius; Text Search can only restrict to a rectangle. */
function rectangle(center: LatLng, radiusM: number) {
	const dLat = radiusM / 111_320;
	const dLng = radiusM / (111_320 * Math.cos((center.lat * Math.PI) / 180));
	return {
		rectangle: {
			low: { latitude: center.lat - dLat, longitude: center.lng - dLng },
			high: { latitude: center.lat + dLat, longitude: center.lng + dLng },
		},
	};
}

export const googleProvider: GeoProvider = {
	name: "google",

	async autocomplete({ text, bias, sessionToken }) {
		const data = await request<{
			suggestions?: {
				placePrediction?: { placeId: string; text?: { text?: string } };
			}[];
		}>("/places:autocomplete", {
			method: "POST",
			body: {
				input: text,
				includedRegionCodes: [REGION.toLowerCase()],
				languageCode: LANGUAGE,
				...(sessionToken ? { sessionToken } : {}),
				...(bias ? { locationBias: circle(bias, MAX_BIAS_RADIUS_M) } : {}),
			},
		});

		return (data.suggestions ?? []).flatMap((s) =>
			s.placePrediction
				? [
						{
							id: s.placePrediction.placeId,
							label: s.placePrediction.text?.text ?? "",
							// Google returns no coordinates here; `details` fills them in.
							lat: null,
							lng: null,
							city: null,
							state: null,
							street: null,
						},
					]
				: [],
		);
	},

	async details({ id, sessionToken }) {
		const qs = new URLSearchParams({ languageCode: LANGUAGE });
		if (sessionToken) qs.set("sessionToken", sessionToken);
		const place = await request<GooglePlace>(
			`/places/${encodeURIComponent(id)}?${qs}`,
			{
				method: "GET",
				fieldMask: "id,displayName,formattedAddress,location,addressComponents",
			},
		);
		return place.location ? toResult({ ...place, id: place.id ?? id }) : null;
	},

	async search({ text, near, radiusM }) {
		const data = await request<{ places?: GooglePlace[] }>(
			"/places:searchText",
			{
				method: "POST",
				fieldMask:
					"places.id,places.displayName,places.formattedAddress,places.location,places.addressComponents",
				body: {
					textQuery: text,
					regionCode: REGION,
					languageCode: LANGUAGE,
					pageSize: 5,
					...(near && radiusM
						? { locationRestriction: rectangle(near, radiusM) }
						: near
							? { locationBias: circle(near, MAX_BIAS_RADIUS_M) }
							: {}),
				},
			},
		);
		return (data.places ?? []).map(toResult);
	},
};
