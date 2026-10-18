import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { call, callReport, callReportCategories } from "@/db/schema";
import { selectCallReportSchema } from "@/db/zod";
import { json, requireInternal, validationError } from "@/lib/api-utils";
import { apiError } from "@/lib/errors";
import { registry } from "@/lib/openapi";
import { toPersonPhone } from "@/lib/person";

// ─── POST /api/internal/calls/report ─────────────────────────────────────────
// The voice AI's `report_abuse` tool. Files one report per call for the admins
// to review; a second report for the same call returns the first one.

const bodySchema = z.object({
	callSid: z.string().min(1),
	phoneNumber: z.string().min(1),
	category: z.enum(callReportCategories),
	summary: z.string().trim().min(1).max(1000),
});

export async function POST(req: NextRequest) {
	try {
		requireInternal(req);
		const parsed = bodySchema.safeParse(await req.json());
		if (!parsed.success) return validationError(parsed.error.issues);

		const phoneNumber = toPersonPhone(parsed.data.phoneNumber);
		if (!phoneNumber) return apiError("CALLER_PHONE_REQUIRED");

		const [row] = await db
			.select({ id: call.id })
			.from(call)
			.where(eq(call.callSid, parsed.data.callSid));
		if (!row) return apiError("CALL_NOT_FOUND");

		const [created] = await db
			.insert(callReport)
			.values({
				callId: row.id,
				phoneNumber,
				category: parsed.data.category,
				summary: parsed.data.summary,
			})
			.onConflictDoNothing({ target: callReport.callId })
			.returning();

		const report =
			created ??
			(await db.query.callReport.findFirst({
				where: eq(callReport.callId, row.id),
			}));
		if (!report) return apiError("INTERNAL_ERROR");

		return json(report, created ? 201 : 200);
	} catch (e) {
		if (e instanceof Response) return e;
		return apiError("INTERNAL_ERROR");
	}
}

registry.registerPath({
	method: "post",
	path: "/api/internal/calls/report",
	tags: ["Abuse"],
	summary: "Report an abusive call (voice service)",
	request: {
		body: { content: { "application/json": { schema: bodySchema } } },
	},
	responses: {
		201: {
			description: "Report filed",
			content: { "application/json": { schema: selectCallReportSchema } },
		},
		200: {
			description: "This call was already reported",
			content: { "application/json": { schema: selectCallReportSchema } },
		},
	},
});
