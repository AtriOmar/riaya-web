import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { person } from "@/db/schema";
import { apiError, json, validationError } from "@/lib/api-utils";

// ─── PATCH /api/persons/[id] ─────────────────────────────────────────────────
// Public endpoint — updates a person's info.
// Called by the socket AI tool (update_person_info) after collecting caller details.

const updateSchema = z.object({
	firstName: z.string().min(1).optional(),
	lastName: z.string().min(1).optional(),
	dateOfBirth: z.string().datetime().optional(),
	gender: z.string().min(1).optional(),
	address: z.string().optional(),
});

export async function PATCH(
	req: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	try {
		const { id } = await params;
		const personId = Number(id);
		if (Number.isNaN(personId)) return apiError("INVALID_ID");

		const existing = await db.query.person.findFirst({
			where: eq(person.id, personId),
		});
		if (!existing) return apiError("PERSON_NOT_FOUND");

		const body = await req.json();
		const parsed = updateSchema.safeParse(body);
		if (!parsed.success) return validationError(parsed.error.issues);

		const { dateOfBirth, ...rest } = parsed.data;

		await db
			.update(person)
			.set({
				...rest,
				...(dateOfBirth ? { dateOfBirth: new Date(dateOfBirth) } : {}),
				updatedAt: new Date(),
			})
			.where(eq(person.id, personId));

		const updated = await db.query.person.findFirst({
			where: eq(person.id, personId),
		});

		return json(updated);
	} catch (e) {
		if (e instanceof Response) return e;
		return apiError("INTERNAL_ERROR");
	}
}

import { selectPersonSchema } from "@/db/zod";
import { registry } from "@/lib/openapi";

const paramsSchema = z.object({ id: z.string() });

registry.registerPath({
	method: "get",
	path: "/api/persons/{id}",
	tags: ["Users"],
	summary: "Get person by ID",
	request: { params: paramsSchema },
	responses: {
		200: {
			description: "Person details",
			content: { "application/json": { schema: selectPersonSchema } },
		},
	},
});

registry.registerPath({
	method: "patch",
	path: "/api/persons/{id}",
	tags: ["Users"],
	summary: "Update person by ID",
	request: {
		params: paramsSchema,
		body: { content: { "application/json": { schema: updateSchema } } },
	},
	responses: {
		200: {
			description: "Updated person",
			content: { "application/json": { schema: selectPersonSchema } },
		},
	},
});
