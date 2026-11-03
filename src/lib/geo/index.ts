import { geoapifyProvider } from "./geoapify";
import { googleProvider } from "./google";
import type { GeoProvider } from "./types";

export * from "./types";

function byName(name: string | undefined): GeoProvider | null {
	switch (name?.trim().toLowerCase()) {
		case "google":
			return googleProvider;
		case "geoapify":
			return geoapifyProvider;
		default:
			return null;
	}
}

/**
 * The provider for address suggestions and routing, chosen by the
 * `GEO_PROVIDER` env var ("geoapify" by default, or "google"). Change the
 * variable and restart to switch; no code changes are needed.
 */
export function getGeoProvider(): GeoProvider {
	return byName(process.env.GEO_PROVIDER) ?? geoapifyProvider;
}

/**
 * The provider for the voice agent's place search. `GEO_SEARCH_PROVIDER` sets
 * it on its own, so the metered Google key can be spent here only; it follows
 * `GEO_PROVIDER` when unset.
 */
export function getPlaceSearchProvider(): GeoProvider {
	return byName(process.env.GEO_SEARCH_PROVIDER) ?? getGeoProvider();
}
