import type { NextRequest } from "next/server";
import { z } from "zod";
import { personPhoneRelationships } from "@/db/schema";
import { json, requireInternal, validationError } from "@/lib/api-utils";
import { apiError } from "@/lib/errors";
import { registry } from "@/lib/openapi";
import { findPersonsOnPhone } from "@/lib/person";

// ─── POST /api/internal/caller/people ────────────────────────────────────────
// Everyone on the calling phone (owner + family), so the voice assistant can
// ask who an appointment is for.

const bodySchema = z.object({
	phoneNumber: z.string().min(1),
});

const personOnLineSchema = z.object({
	personId: z.number().int(),
	firstName: z.string().nullable(),
	lastName: z.string().nullable(),
	relationship: z.enum(personPhoneRelationships),
});

const peopleResponseSchema = z.object({
	people: z.array(personOnLineSchema),
});

export async function POST(req: NextRequest) {
	try {
		requireInternal(req);
		const parsed = bodySchema.safeParse(await req.json());
		if (!parsed.success) return validationError(parsed.error.issues);

		const persons = await findPersonsOnPhone(parsed.data.phoneNumber);
		return json({
			people: persons.map((p) => ({
				personId: p.id,
				firstName: p.firstName,
				lastName: p.lastName,
				relationship: p.relationship,
			})),
		});
	} catch (e) {
		if (e instanceof Response) return e;
		return apiError("INTERNAL_ERROR");
	}
}

registry.registerPath({
	method: "post",
	path: "/api/internal/caller/people",
	tags: ["Caller"],
	summary: "People on the caller's phone (voice service)",
	request: {
		body: { content: { "application/json": { schema: bodySchema } } },
	},
	responses: {
		200: {
			description: "The phone owner and their family members",
			content: { "application/json": { schema: peopleResponseSchema } },
		},
	},
});
