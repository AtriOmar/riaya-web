import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { call, callEvent } from "@/db/schema";
import { apiError, json, validationError } from "@/lib/api-utils";

// ─── POST /api/calls/[id]/events ─────────────────────────────────────────────
// Internal: called by the socket to persist transcripts, function calls,
// system messages, errors, and appointment-booked signals for a call.

const createEventSchema = z.object({
	type: z.enum([
		"patient_transcript",
		"ai_transcript",
		"function_call",
		"system",
		"error",
		"appointment_booked",
	]),
	content: z.string().optional(),
	functionName: z.string().optional(),
	functionArgs: z.unknown().optional(),
	functionResult: z.unknown().optional(),
	functionStatus: z.enum(["calling", "success", "error"]).optional(),
});

export async function POST(
	req: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	try {
		// await requireInternal(req);

		const { id } = await params;
		const callId = Number(id);
		if (Number.isNaN(callId)) return apiError("INVALID_ID");

		const [existing] = await db
			.select({ id: call.id })
			.from(call)
			.where(eq(call.id, callId));
		if (!existing) return apiError("CALL_NOT_FOUND");

		const body = await req.json();
		const parsed = createEventSchema.safeParse(body);
		if (!parsed.success) return validationError(parsed.error.issues);

		const [created] = await db
			.insert(callEvent)
			.values({
				callId,
				type: parsed.data.type,
				content: parsed.data.content,
				functionName: parsed.data.functionName,
				functionArgs: parsed.data.functionArgs ?? null,
				functionResult: parsed.data.functionResult ?? null,
				functionStatus: parsed.data.functionStatus,
				timestamp: new Date(),
			})
			.returning();

		return json(created, 201);
	} catch (e) {
		if (e instanceof Response) return e;
		return apiError("INTERNAL_ERROR");
	}
}
