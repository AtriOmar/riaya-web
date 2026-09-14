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
	let phoneHint: string | undefined;
	try {
		const body = await req.json();
		if (body && typeof body === "object" && "phoneNumber" in body) {
			phoneHint =
				typeof body.phoneNumber === "string" ? body.phoneNumber : undefined;
		}
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
		console.error("[api/persons POST]", { phoneNumber: phoneHint }, e);
		return apiError("INTERNAL_ERROR");
	}
}

import { selectPersonSchema } from "@/db/zod";
import { registry } from "@/lib/openapi";

registry.registerPath({
	method: "get",
	path: "/api/persons",
	tags: ["Users"],
	summary: "List persons",
	responses: {
		200: {
			description: "List of persons",
			content: { "application/json": { schema: z.array(selectPersonSchema) } },
		},
	},
});

registry.registerPath({
	method: "post",
	path: "/api/persons",
	tags: ["Users"],
	summary: "Create or get person",
	request: {
		body: { content: { "application/json": { schema: createSchema } } },
	},
	responses: {
		200: {
			description: "Existing person",
			content: { "application/json": { schema: selectPersonSchema } },
		},
		201: {
			description: "Created person",
			content: { "application/json": { schema: selectPersonSchema } },
		},
	},
});
