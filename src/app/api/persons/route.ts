import type { NextRequest } from "next/server";
import { z } from "zod";
import {
	apiError,
	json,
	requireInternal,
	validationError,
} from "@/lib/api-utils";
import { personSources, upsertPhoneOwner } from "@/lib/person";

// ─── POST /api/persons ────────────────────────────────────────────────────────
// Internal (voice service): find or create the phone's owner when a call starts.

const createSchema = z.object({
	phoneNumber: z.string().min(1),
	source: z.enum(personSources).optional().default("call"),
});

export async function POST(req: NextRequest) {
	let phoneHint: string | undefined;
	try {
		requireInternal(req);
		const body = await req.json();
		if (body && typeof body === "object" && "phoneNumber" in body) {
			phoneHint =
				typeof body.phoneNumber === "string" ? body.phoneNumber : undefined;
		}
		const parsed = createSchema.safeParse(body);

		if (!parsed.success) return validationError(parsed.error.issues);

		const row = await upsertPhoneOwner(
			parsed.data.phoneNumber,
			parsed.data.source,
		);
		if (!row) return apiError("VALIDATION_ERROR");

		return json(row);
	} catch (e) {
		if (e instanceof Response) return e;
		console.error("[api/persons POST]", { phoneNumber: phoneHint }, e);
		return apiError("INTERNAL_ERROR");
	}
}

import { selectPersonSchema } from "@/db/zod";
import { registry } from "@/lib/openapi";

registry.registerPath({
	method: "post",
	path: "/api/persons",
	tags: ["Internal"],
	summary: "Find or create the phone owner (voice service)",
	request: {
		body: { content: { "application/json": { schema: createSchema } } },
	},
	responses: {
		200: {
			description: "The phone's owner",
			content: { "application/json": { schema: selectPersonSchema } },
		},
	},
});
