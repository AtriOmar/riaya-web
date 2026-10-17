// Drive time / road distance from one origin to several targets (Geoapify
// Route Matrix). Used as a second, precise ranking pass on a short candidate
// list only — never on every doctor. Any failure returns null so callers fall
// back to straight-line distance.

const ENDPOINT = "https://api.geoapify.com/v1/routematrix";
const TIMEOUT_MS = 3000;

export type RouteLeg = { distanceKm: number; minutes: number } | null;

type MatrixResponse = {
	sources_to_targets?: {
		distance?: number | null;
		time?: number | null;
	}[][];
};

export async function getDriveLegs(
	origin: { lat: number; long: number },
	targets: { lat: number; long: number }[],
): Promise<RouteLeg[] | null> {
	const apiKey = process.env.GEOAPIFY_API_KEY;
	if (!apiKey || targets.length === 0) return null;

	try {
		const res = await fetch(`${ENDPOINT}?apiKey=${apiKey}`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				mode: "drive",
				sources: [{ location: [origin.long, origin.lat] }],
				targets: targets.map((t) => ({ location: [t.long, t.lat] })),
			}),
			signal: AbortSignal.timeout(TIMEOUT_MS),
		});
		if (!res.ok) return null;

		const data = (await res.json()) as MatrixResponse;
		const row = data.sources_to_targets?.[0];
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
