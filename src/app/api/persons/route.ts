import type { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, json, validationError } from "@/lib/api-utils";
import { personSources, upsertPersonByPhone } from "@/lib/person";

// ─── POST /api/persons ────────────────────────────────────────────────────────
// Public endpoint — upserts a person by phone number.
// Called by the socket server when a Twilio call starts.

const createSchema = z.object({
	phoneNumber: z.string().min(1),
	source: z.enum(personSources).optional().default("call"),
});

export async function POST(req: NextRequest) {
	try {
		const body = await req.json();
		const parsed = createSchema.safeParse(body);

		if (!parsed.success) return validationError(parsed.error.issues);

		const row = await upsertPersonByPhone(
			parsed.data.phoneNumber,
			parsed.data.source,
		);
		if (!row) return apiError("VALIDATION_ERROR");

		return json(row, 201);
	} catch (e) {
		if (e instanceof Response) return e;
		return apiError("INTERNAL_ERROR");
	}
}
