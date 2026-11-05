import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { call, callUsage } from "@/db/schema";
import { apiError, json, validationError } from "@/lib/api-utils";

// ─── PUT /api/calls/[id]/usage ───────────────────────────────────────────────
// Internal: the socket sends the billed tokens of one model when the call
// ends. One row per call and model; sending it again replaces the counts.

const tokenCount = z.coerce.number().int().nonnegative();

const upsertUsageSchema = z.object({
	model: z.string().min(1).max(100),
	textInputTokens: tokenCount,
	audioInputTokens: tokenCount,
	textOutputTokens: tokenCount,
	audioOutputTokens: tokenCount,
	raw: z.unknown().optional(),
});

export async function PUT(
	req: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	try {
		// requireInternal(req);

		const { id } = await params;
		const callId = Number(id);
		if (Number.isNaN(callId)) return apiError("INVALID_ID");

		const [existing] = await db
			.select({ id: call.id })
			.from(call)
			.where(eq(call.id, callId));
		if (!existing) return apiError("CALL_NOT_FOUND");

		const body = await req.json();
		const parsed = upsertUsageSchema.safeParse(body);
		if (!parsed.success) return validationError(parsed.error.issues);

		const { raw, ...counts } = parsed.data;
		const values = { ...counts, raw: raw ?? null };

		const [saved] = await db
			.insert(callUsage)
			.values({ callId, ...values })
			.onConflictDoUpdate({
				target: [callUsage.callId, callUsage.model],
				set: { ...values, updatedAt: new Date() },
			})
			.returning();

		return json(saved);
	} catch (e) {
		if (e instanceof Response) return e;
		return apiError("INTERNAL_ERROR");
	}
}

import { selectCallUsageSchema } from "@/db/zod";
import { registry } from "@/lib/openapi";

const paramsSchema = z.object({
	id: z.string(),
});

registry.registerPath({
	method: "put",
	path: "/api/calls/{id}/usage",
	tags: ["Calls"],
	summary: "Save the billed tokens of a call",
	request: {
		params: paramsSchema,
		body: {
			content: { "application/json": { schema: upsertUsageSchema } },
		},
	},
	responses: {
		200: {
			description: "Saved usage",
			content: { "application/json": { schema: selectCallUsageSchema } },
		},
	},
});
