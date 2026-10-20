import type { NextRequest } from "next/server";
import { z } from "zod";
import { json, requireInternal, validationError } from "@/lib/api-utils";
import { apiError } from "@/lib/errors";
import { getGeoProvider, placeResultSchema } from "@/lib/geo";
import { registry } from "@/lib/openapi";

// ─── GET /api/internal/places/search ─────────────────────────────────────────
// Full-text place lookup for the voice service (patient says a place name).
// Uses the active geo provider (GEO_PROVIDER).

const schema = z.object({
	text: z.string().min(1).max(300),
	lat: z.coerce.number().optional(),
	lng: z.coerce.number().optional(),
	/** Only return places within this many metres of lat/lng. */
	radiusM: z.coerce.number().positive().optional(),
});

export async function GET(req: NextRequest) {
	try {
		requireInternal(req);
		const parsed = schema.safeParse(
			Object.fromEntries(req.nextUrl.searchParams),
		);
		if (!parsed.success) return validationError(parsed.error.issues);

		const { text, lat, lng, radiusM } = parsed.data;
		const results = await getGeoProvider().search({
			text,
			radiusM,
			near: lat != null && lng != null ? { lat, lng } : undefined,
		});
		return json(results);
	} catch (e) {
		if (e instanceof Response) return e;
		console.error("internal/places/search failed:", e);
		return apiError("GEOCODING_FAILED");
	}
}

registry.registerPath({
	method: "get",
	path: "/api/internal/places/search",
	tags: ["Places"],
	summary: "Place lookup by text (voice service)",
	request: { query: schema },
	responses: {
		200: {
			description: "Up to 5 matching places",
			content: { "application/json": { schema: z.array(placeResultSchema) } },
		},
	},
});
