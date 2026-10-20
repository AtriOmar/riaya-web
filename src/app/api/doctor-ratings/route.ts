import type { NextRequest } from "next/server";
import { z } from "zod";
import { doctorRatingListItemSchema } from "@/db/zod";
import { apiError, json, requireAdmin, validationError } from "@/lib/api-utils";
import { registry } from "@/lib/openapi";
import { doctorRatingSorts, listDoctorRatings } from "@/lib/review-summary";

// ─── GET /api/doctor-ratings ─────────────────────────────────────────────────
// Admin-only: patient ratings per doctor, with their best-fit exclusion state.

const querySchema = z.object({
	sort: z.enum(doctorRatingSorts).default("average_asc"),
});

export async function GET(req: NextRequest) {
	try {
		await requireAdmin();
		const parsed = querySchema.safeParse(
			Object.fromEntries(req.nextUrl.searchParams),
		);
		if (!parsed.success) return validationError(parsed.error.issues);

		return json(await listDoctorRatings(parsed.data.sort));
	} catch (e) {
		if (e instanceof Response) return e;
		console.error("Failed to list doctor ratings:", e);
		return apiError("INTERNAL_ERROR");
	}
}

registry.registerPath({
	method: "get",
	path: "/api/doctor-ratings",
	tags: ["Ratings"],
	summary: "List doctors' patient ratings (Admin)",
	request: { query: querySchema },
	responses: {
		200: {
			description: "Doctors with submitted reviews, plus excluded doctors",
			content: {
				"application/json": { schema: z.array(doctorRatingListItemSchema) },
			},
		},
	},
});
