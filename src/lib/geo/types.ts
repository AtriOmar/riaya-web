import { z } from "zod";

/** One place/address returned by whichever geo provider is active. */
export const placeResultSchema = z.object({
	/** Provider-specific id; pass it back to `details` to get coordinates. */
	id: z.string(),
	label: z.string(),
	/** Null for providers (Google autocomplete) that need a `details` call. */
	lat: z.number().nullable(),
	lng: z.number().nullable(),
	city: z.string().nullable(),
	state: z.string().nullable(),
	street: z.string().nullable(),
});

export type PlaceResult = z.infer<typeof placeResultSchema>;
export type LatLng = { lat: number; lng: number };
export type GeoProviderName = "geoapify" | "google";

/**
 * Everything the app needs from a places/geocoding service. Add a provider by
 * implementing this and registering it in `./index.ts`.
 */
export interface GeoProvider {
	readonly name: GeoProviderName;
	/** As-you-type suggestions (address bar). */
	autocomplete(input: {
		text: string;
		bias?: LatLng;
		sessionToken?: string;
	}): Promise<PlaceResult[]>;
	/** Coordinates for a suggestion that came back without them. */
	details(input: {
		id: string;
		sessionToken?: string;
	}): Promise<PlaceResult | null>;
	/** Full-text lookup, optionally limited to a radius around `near`. */
	search(input: {
		text: string;
		near?: LatLng;
		radiusM?: number;
	}): Promise<PlaceResult[]>;
}

export class GeoProviderError extends Error {
	constructor(
		message: string,
		readonly provider: GeoProviderName,
	) {
		super(message);
		this.name = "GeoProviderError";
	}
}

export const GEO_TIMEOUT_MS = 6000;
