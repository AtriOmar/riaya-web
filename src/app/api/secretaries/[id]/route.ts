import { and, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { secretary } from "@/db/schema";
import {
	apiError,
	json,
	requireDoctorProfile,
	requireSession,
} from "@/lib/api-utils";

// ─── DELETE /api/secretaries/[id] ──────────────────────────────────────────────
// Removes a secretary from the practice. Their account stays, without access.

export async function DELETE(
	_req: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	try {
		const session = await requireSession();
		const profile = await requireDoctorProfile(session.user.id);

		const { id } = await params;
		const secretaryId = Number(id);
		if (Number.isNaN(secretaryId)) return apiError("INVALID_ID");

		const deleted = await db
			.delete(secretary)
			.where(
				and(eq(secretary.id, secretaryId), eq(secretary.doctorId, profile.id)),
			)
			.returning({ id: secretary.id });
		if (deleted.length === 0) return apiError("SECRETARY_NOT_FOUND");

		return json({ ok: true });
	} catch (e) {
		if (e instanceof Response) return e;
		return apiError("INTERNAL_ERROR");
	}
}

import { registry } from "@/lib/openapi";

registry.registerPath({
	method: "delete",
	path: "/api/secretaries/{id}",
	tags: ["Team"],
	summary: "Remove a secretary",
	request: { params: z.object({ id: z.string() }) },
	responses: {
		200: {
			description: "Secretary removed",
			content: {
				"application/json": { schema: z.object({ ok: z.boolean() }) },
			},
		},
	},
});
