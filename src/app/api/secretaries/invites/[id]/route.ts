import { and, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { secretaryInvite } from "@/db/schema";
import {
	apiError,
	json,
	requireDoctorProfile,
	requireSession,
} from "@/lib/api-utils";

// ─── DELETE /api/secretaries/invites/[id] ─────────────────────────────────────
// Cancels an invite; its link stops working.

export async function DELETE(
	_req: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	try {
		const session = await requireSession();
		const profile = await requireDoctorProfile(session.user.id);

		const { id } = await params;
		const inviteId = Number(id);
		if (Number.isNaN(inviteId)) return apiError("INVALID_ID");

		const deleted = await db
			.delete(secretaryInvite)
			.where(
				and(
					eq(secretaryInvite.id, inviteId),
					eq(secretaryInvite.doctorId, profile.id),
				),
			)
			.returning({ id: secretaryInvite.id });
		if (deleted.length === 0) return apiError("INVITE_NOT_FOUND");

		return json({ ok: true });
	} catch (e) {
		if (e instanceof Response) return e;
		return apiError("INTERNAL_ERROR");
	}
}

import { registry } from "@/lib/openapi";

registry.registerPath({
	method: "delete",
	path: "/api/secretaries/invites/{id}",
	tags: ["Team"],
	summary: "Cancel a secretary invite",
	request: { params: z.object({ id: z.string() }) },
	responses: {
		200: {
			description: "Invite cancelled",
			content: {
				"application/json": { schema: z.object({ ok: z.boolean() }) },
			},
		},
	},
});
