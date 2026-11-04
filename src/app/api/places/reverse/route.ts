import type { NextRequest } from "next/server";
import { z } from "zod";
import { json, requireSession, validationError } from "@/lib/api-utils";
import { apiError } from "@/lib/errors";
import { getGeoProvider, placeResultSchema } from "@/lib/geo";
import { registry } from "@/lib/openapi";

// ─── GET /api/places/reverse ─────────────────────────────────────────────────
// The address at a point picked on the map. Null when the provider knows none.

const schema = z.object({
	lat: z.coerce.number().min(-90).max(90),
	lng: z.coerce.number().min(-180).max(180),
});

export async function GET(req: NextRequest) {
	try {
		await requireSession();
		const parsed = schema.safeParse(
			Object.fromEntries(req.nextUrl.searchParams),
		);
		if (!parsed.success) return validationError(parsed.error.issues);

		return json(await getGeoProvider().reverse(parsed.data));
	} catch (e) {
		if (e instanceof Response) return e;
		console.error("places/reverse failed:", e);
		return apiError("GEOCODING_FAILED");
	}
}

registry.registerPath({
	method: "get",
	path: "/api/places/reverse",
	tags: ["Places"],
	summary: "Address at a map point",
	request: { query: schema },
	responses: {
		200: {
			description: "The address at the point, or null when there is none",
			content: {
				"application/json": { schema: placeResultSchema.nullable() },
			},
		},
	},
});
