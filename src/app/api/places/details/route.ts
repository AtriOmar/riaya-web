import type { NextRequest } from "next/server";
import { z } from "zod";
import { json, requireSession, validationError } from "@/lib/api-utils";
import { apiError } from "@/lib/errors";
import { getGeoProvider, placeResultSchema } from "@/lib/geo";
import { registry } from "@/lib/openapi";

// ─── GET /api/places/details ─────────────────────────────────────────────────
// Coordinates for a suggestion picked from /api/places/autocomplete. Only
// needed when the provider returns suggestions without coordinates (Google).

const schema = z.object({
	id: z.string().min(1).max(300),
	sessionToken: z.string().max(100).optional(),
});

export async function GET(req: NextRequest) {
	try {
		await requireSession();
		const parsed = schema.safeParse(
			Object.fromEntries(req.nextUrl.searchParams),
		);
		if (!parsed.success) return validationError(parsed.error.issues);

		const place = await getGeoProvider().details(parsed.data);
		if (!place) return apiError("GEOCODING_FAILED");
		return json(place);
	} catch (e) {
		if (e instanceof Response) return e;
		console.error("places/details failed:", e);
		return apiError("GEOCODING_FAILED");
	}
}

registry.registerPath({
	method: "get",
	path: "/api/places/details",
	tags: ["Places"],
	summary: "Coordinates and address parts for a picked suggestion",
	request: { query: schema },
	responses: {
		200: {
			description: "The place with coordinates",
			content: { "application/json": { schema: placeResultSchema } },
		},
	},
});
