import { doctorDashboardStatsResponseSchema } from "@/db/zod";
import { apiError, json } from "@/lib/api-utils";
import { getDoctorDashboardStats } from "@/lib/dashboard-stats";
import { registry } from "@/lib/openapi";
import { requirePractice } from "@/lib/practice";

// ─── GET /api/dashboard/stats ─────────────────────────────────────────────────

export async function GET() {
	try {
		const { doctor: profile } = await requirePractice();
		return json(await getDoctorDashboardStats(profile.id));
	} catch (e) {
		if (e instanceof Response) return e;
		return apiError("INTERNAL_ERROR");
	}
}

registry.registerPath({
	method: "get",
	path: "/api/dashboard/stats",
	tags: ["Dashboard"],
	summary: "Get doctor dashboard statistics",
	responses: {
		200: {
			description: "Doctor dashboard statistics",
			content: {
				"application/json": { schema: doctorDashboardStatsResponseSchema },
			},
		},
	},
});
