import type { NextRequest } from "next/server";
import { z } from "zod";
import { doctorFeedbackResponseSchema } from "@/db/zod";
import { apiError, json, requireAdmin } from "@/lib/api-utils";
import { registry } from "@/lib/openapi";
import { getDoctorFeedback } from "@/lib/review-summary";

const paramsSchema = z.object({ id: z.coerce.number().int().positive() });

// ─── GET /api/doctor-ratings/[id] ────────────────────────────────────────────
// Admin-only: one doctor's rating stats and submitted reviews with comments.

export async function GET(
	_req: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	try {
		await requireAdmin();
		const parsedParams = paramsSchema.safeParse(await params);
		if (!parsedParams.success) return apiError("INVALID_ID");

		const feedback = await getDoctorFeedback(parsedParams.data.id);
		if (!feedback) return apiError("DOCTOR_NOT_FOUND");
		return json(feedback);
	} catch (e) {
		if (e instanceof Response) return e;
		console.error("Failed to load doctor feedback:", e);
		return apiError("INTERNAL_ERROR");
	}
}

registry.registerPath({
	method: "get",
	path: "/api/doctor-ratings/{id}",
	tags: ["Ratings"],
	summary: "Get one doctor's patient feedback (Admin)",
	request: { params: z.object({ id: z.string() }) },
	responses: {
		200: {
			description: "Rating stats and submitted reviews, newest first",
			content: {
				"application/json": { schema: doctorFeedbackResponseSchema },
			},
		},
	},
});
