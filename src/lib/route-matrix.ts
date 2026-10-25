// Drive time / road distance from one origin to several targets, from the
// active geo provider (GEO_PROVIDER: Google Routes or Geoapify Route Matrix).
// Used as a second, precise ranking pass on a short candidate list only —
// never on every doctor. Any failure returns null so callers fall back to
// straight-line distance.

import { getGeoProvider, type RouteLeg } from "@/lib/geo";

export type { RouteLeg };

export function getDriveLegs(
	origin: { lat: number; long: number },
	targets: { lat: number; long: number }[],
): Promise<RouteLeg[] | null> {
	return getGeoProvider().driveLegs({
		origin: { lat: origin.lat, lng: origin.long },
		targets: targets.map((t) => ({ lat: t.lat, lng: t.long })),
	});
}
