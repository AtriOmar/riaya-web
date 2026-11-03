import { count, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { doctorApplication } from "@/db/schema";
import { apiError, json, requireAdmin } from "@/lib/api-utils";
import { registry } from "@/lib/openapi";

// ─── GET /api/doctor-applications/count ──────────────────────────────────────
// Admin-only: pending applications waiting for review (sidebar badge).

const responseSchema = z.object({ pending: z.number().int() });

export async function GET() {
	try {
		await requireAdmin();
		const [row] = await db
			.select({ pending: count() })
			.from(doctorApplication)
			.where(eq(doctorApplication.status, "pending"));
		return json({ pending: row?.pending ?? 0 });
	} catch (e) {
		if (e instanceof Response) return e;
		return apiError("INTERNAL_ERROR");
	}
}

registry.registerPath({
	method: "get",
	path: "/api/doctor-applications/count",
	tags: ["Doctors"],
	summary: "Count pending doctor applications (Admin)",
	responses: {
		200: {
			description: "Number of pending applications",
			content: { "application/json": { schema: responseSchema } },
		},
	},
});
