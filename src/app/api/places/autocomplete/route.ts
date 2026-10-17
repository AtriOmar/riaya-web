import type { NextRequest } from "next/server";
import { z } from "zod";
import { json, requireSession, validationError } from "@/lib/api-utils";
import { apiError } from "@/lib/errors";
import { getGeoProvider, placeResultSchema } from "@/lib/geo";
import { registry } from "@/lib/openapi";

// ─── GET /api/places/autocomplete ────────────────────────────────────────────
// Address suggestions for the signed-in user. Proxies the active geo provider
// (GEO_PROVIDER) so the provider's API key never reaches the browser.

const schema = z.object({
	text: z.string().min(1).max(200),
	lat: z.coerce.number().optional(),
	lng: z.coerce.number().optional(),
	/** One id per typing session; lets Google bill suggestions + pick as one. */
	sessionToken: z.string().max(100).optional(),
});

export async function GET(req: NextRequest) {
	try {
		await requireSession();
		const parsed = schema.safeParse(
			Object.fromEntries(req.nextUrl.searchParams),
		);
		if (!parsed.success) return validationError(parsed.error.issues);

		const { text, lat, lng, sessionToken } = parsed.data;
		const results = await getGeoProvider().autocomplete({
			text,
			sessionToken,
			bias: lat != null && lng != null ? { lat, lng } : undefined,
		});
		return json(results);
	} catch (e) {
		if (e instanceof Response) return e;
		console.error("places/autocomplete failed:", e);
		return apiError("GEOCODING_FAILED");
	}
}

registry.registerPath({
	method: "get",
	path: "/api/places/autocomplete",
	tags: ["Places"],
	summary: "Address suggestions from the active geo provider",
	request: { query: schema },
	responses: {
		200: {
			description: "Up to 5 suggestions",
			content: { "application/json": { schema: z.array(placeResultSchema) } },
		},
	},
});
