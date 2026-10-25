import { geoapifyProvider } from "./geoapify";
import { googleProvider } from "./google";
import type { GeoProvider } from "./types";

export * from "./types";

/**
 * The active places/geocoding and routing provider, chosen by the
 * `GEO_PROVIDER` env var ("geoapify" by default, or "google"). Change the
 * variable and restart to switch; no code changes are needed.
 */
export function getGeoProvider(): GeoProvider {
	const name = (process.env.GEO_PROVIDER ?? "geoapify").trim().toLowerCase();
	return name === "google" ? googleProvider : geoapifyProvider;
}
