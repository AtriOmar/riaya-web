import { count, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { callReport } from "@/db/schema";
import { apiError, json, requireAdmin } from "@/lib/api-utils";
import { registry } from "@/lib/openapi";

// ─── GET /api/call-reports/count ─────────────────────────────────────────────
// Admin-only: open reports waiting for review (sidebar badge).

const responseSchema = z.object({ open: z.number().int() });

export async function GET() {
	try {
		await requireAdmin();
		const [row] = await db
			.select({ open: count() })
			.from(callReport)
			.where(eq(callReport.status, "open"));
		return json({ open: row?.open ?? 0 });
	} catch (e) {
		if (e instanceof Response) return e;
		return apiError("INTERNAL_ERROR");
	}
}

registry.registerPath({
	method: "get",
	path: "/api/call-reports/count",
	tags: ["Abuse"],
	summary: "Count open call reports (Admin)",
	responses: {
		200: {
			description: "Number of open reports",
			content: { "application/json": { schema: responseSchema } },
		},
	},
});
