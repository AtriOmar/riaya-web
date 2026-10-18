import { and, desc, eq, ne } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { blockedPhone, callReport } from "@/db/schema";
import { selectCallReportDetailSchema, selectCallReportSchema } from "@/db/zod";
import { apiError, json, requireAdmin, validationError } from "@/lib/api-utils";
import { activeBlock } from "@/lib/blocked-phone";
import { getNumberContexts } from "@/lib/call-reports";
import { registry } from "@/lib/openapi";

const paramsSchema = z.object({ id: z.coerce.number().int().positive() });

// ─── GET /api/call-reports/[id] ──────────────────────────────────────────────
// Admin-only: one report with the call's transcript, the number's earlier
// reports, and its current block (if any).

export async function GET(
	_req: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	try {
		await requireAdmin();
		const parsedParams = paramsSchema.safeParse(await params);
		if (!parsedParams.success) return apiError("INVALID_ID");
		const { id } = parsedParams.data;

		const report = await db.query.callReport.findFirst({
			where: eq(callReport.id, id),
			with: {
				call: {
					with: { events: { orderBy: (e, { asc }) => [asc(e.timestamp)] } },
				},
			},
		});
		if (!report) return apiError("REPORT_NOT_FOUND");

		const [otherReports, [block], contexts] = await Promise.all([
			db
				.select()
				.from(callReport)
				.where(
					and(
						eq(callReport.phoneNumber, report.phoneNumber),
						ne(callReport.id, report.id),
					),
				)
				.orderBy(desc(callReport.createdAt)),
			db
				.select()
				.from(blockedPhone)
				.where(
					and(eq(blockedPhone.phoneNumber, report.phoneNumber), activeBlock),
				),
			getNumberContexts([report.phoneNumber]),
		]);

		const number = contexts.get(report.phoneNumber);
		return json({
			...report,
			number: number ?? { reportCount: 0, callCount: 0, blocked: false },
			otherReports,
			block: block ?? null,
		});
	} catch (e) {
		if (e instanceof Response) return e;
		return apiError("INTERNAL_ERROR");
	}
}

// ─── PATCH /api/call-reports/[id] ────────────────────────────────────────────
// Admin-only: dismiss a report (not abuse, or not worth a block). Blocking
// goes through POST /api/blocked-phones, which closes the reports itself.

const patchSchema = z.object({
	action: z.enum(["dismiss", "reopen"]),
});

export async function PATCH(
	req: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	try {
		const session = await requireAdmin();
		const parsedParams = paramsSchema.safeParse(await params);
		if (!parsedParams.success) return apiError("INVALID_ID");

		const parsed = patchSchema.safeParse(await req.json());
		if (!parsed.success) return validationError(parsed.error.issues);

		const reopen = parsed.data.action === "reopen";
		const [updated] = await db
			.update(callReport)
			.set({
				status: reopen ? "open" : "dismissed",
				reviewedBy: reopen ? null : session.user.id,
				reviewedAt: reopen ? null : new Date(),
			})
			.where(eq(callReport.id, parsedParams.data.id))
			.returning();
		if (!updated) return apiError("REPORT_NOT_FOUND");

		return json(updated);
	} catch (e) {
		if (e instanceof Response) return e;
		return apiError("INTERNAL_ERROR");
	}
}

registry.registerPath({
	method: "get",
	path: "/api/call-reports/{id}",
	tags: ["Abuse"],
	summary: "Get a reported call (Admin)",
	request: { params: z.object({ id: z.string() }) },
	responses: {
		200: {
			description: "The report with its call transcript",
			content: {
				"application/json": { schema: selectCallReportDetailSchema },
			},
		},
	},
});

registry.registerPath({
	method: "patch",
	path: "/api/call-reports/{id}",
	tags: ["Abuse"],
	summary: "Dismiss or reopen a reported call (Admin)",
	request: {
		params: z.object({ id: z.string() }),
		body: { content: { "application/json": { schema: patchSchema } } },
	},
	responses: {
		200: {
			description: "Updated report",
			content: { "application/json": { schema: selectCallReportSchema } },
		},
	},
});
