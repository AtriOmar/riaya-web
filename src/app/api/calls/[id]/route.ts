import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { call } from "@/db/schema";
import {
	apiError,
	json,
	requireAdmin,
	requireInternal,
	validationError,
} from "@/lib/api-utils";

// ─── GET /api/calls/[id] ─────────────────────────────────────────────────────
// Admin-only. Returns the call with all events.

export async function GET(
	_req: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	try {
		await requireAdmin();

		const { id } = await params;
		const callId = Number(id);
		if (Number.isNaN(callId)) return apiError("INVALID_ID");

		const row = await db.query.call.findFirst({
			where: eq(call.id, callId),
			with: {
				events: { orderBy: (e, { asc }) => [asc(e.timestamp)] },
			},
		});

		if (!row) return apiError("CALL_NOT_FOUND");

		return json(row);
	} catch (e) {
		if (e instanceof Response) return e;
		return apiError("INTERNAL_ERROR");
	}
}

// ─── PUT /api/calls/[id] ─────────────────────────────────────────────────────
// Internal: used by the socket to update status, end time, caller name, appointment link.

const updateSchema = z.object({
	status: z.enum(["in-progress", "completed", "failed"]).optional(),
	callerName: z.string().optional(),
	endedAt: z.iso.datetime().optional(),
	duration: z.coerce.number().int().nonnegative().optional(),
	appointmentId: z.coerce.number().int().positive().nullable().optional(),
});

export async function PUT(
	req: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	try {
		await requireInternal(req);

		const { id } = await params;
		const callId = Number(id);
		if (Number.isNaN(callId)) return apiError("INVALID_ID");

		const body = await req.json();
		const parsed = updateSchema.safeParse(body);
		if (!parsed.success) return validationError(parsed.error.issues);

		const fields = parsed.data;
		const updateData: Record<string, unknown> = { updatedAt: new Date() };
		if (fields.status !== undefined) updateData.status = fields.status;
		if (fields.callerName !== undefined)
			updateData.callerName = fields.callerName;
		if (fields.endedAt !== undefined)
			updateData.endedAt = new Date(fields.endedAt);
		if (fields.duration !== undefined) updateData.duration = fields.duration;
		if (fields.appointmentId !== undefined)
			updateData.appointmentId = fields.appointmentId;

		const [updated] = await db
			.update(call)
			.set(updateData)
			.where(eq(call.id, callId))
			.returning();

		if (!updated) return apiError("CALL_NOT_FOUND");

		return json(updated);
	} catch (e) {
		if (e instanceof Response) return e;
		return apiError("INTERNAL_ERROR");
	}
}
