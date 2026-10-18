import { desc, eq, ne } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { callReport } from "@/db/schema";
import { selectCallReportListItemSchema } from "@/db/zod";
import { apiError, json, requireAdmin, validationError } from "@/lib/api-utils";
import { getNumberContexts } from "@/lib/call-reports";
import { registry } from "@/lib/openapi";

// ─── GET /api/call-reports ───────────────────────────────────────────────────
// Admin-only: calls the voice AI reported as abusive. `open` is the review
// queue; `reviewed` holds the dismissed and blocked ones.

const querySchema = z.object({
	status: z.enum(["open", "reviewed"]).default("open"),
});

export async function GET(req: NextRequest) {
	try {
		await requireAdmin();
		const parsed = querySchema.safeParse(
			Object.fromEntries(req.nextUrl.searchParams),
		);
		if (!parsed.success) return validationError(parsed.error.issues);

		const reports = await db.query.callReport.findMany({
			where:
				parsed.data.status === "open"
					? eq(callReport.status, "open")
					: ne(callReport.status, "open"),
			orderBy: [desc(callReport.createdAt)],
			with: {
				call: {
					columns: {
						id: true,
						startedAt: true,
						duration: true,
						recordingUrl: true,
					},
				},
			},
		});

		const contexts = await getNumberContexts(reports.map((r) => r.phoneNumber));
		return json(
			reports.map((r) => ({
				...r,
				number: contexts.get(r.phoneNumber) ?? {
					reportCount: 0,
					callCount: 0,
					blocked: false,
				},
			})),
		);
	} catch (e) {
		if (e instanceof Response) return e;
		return apiError("INTERNAL_ERROR");
	}
}

registry.registerPath({
	method: "get",
	path: "/api/call-reports",
	tags: ["Abuse"],
	summary: "List reported calls (Admin)",
	request: { query: querySchema },
	responses: {
		200: {
			description: "Reported calls, newest first",
			content: {
				"application/json": { schema: z.array(selectCallReportListItemSchema) },
			},
		},
	},
});
