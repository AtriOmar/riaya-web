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
/** Driving from the origin to one target; null when no route was found. */
export type RouteLeg = { distanceKm: number; minutes: number } | null;

/**
 * Everything the app needs from a places/geocoding and routing service. Add a
 * provider by implementing this and registering it in `./index.ts`.
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
	/**
	 * Road distance and drive time from one origin to each target, in target
	 * order, in one request. Never throws: null means routing failed as a whole.
	 */
	driveLegs(input: {
		origin: LatLng;
		targets: LatLng[];
	}): Promise<RouteLeg[] | null>;
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
/** Routing is a ranking polish, so it gives up early and the straight-line order stays. */
export const ROUTE_TIMEOUT_MS = 3000;
