import { and, eq, gt, isNull } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { doctorProfile, secretary, secretaryInvite } from "@/db/schema";
import { apiError, json, requireSession } from "@/lib/api-utils";
import { getEffectivePlan } from "@/lib/plan-limits";
import { hashInviteToken } from "@/lib/secretaries";

// ─── POST /api/secretary-invites/[token]/accept ───────────────────────────────
// The signed-in user joins the practice as a secretary. Only the invited email
// can accept, and an account can belong to one practice only.

export async function POST(
	_req: NextRequest,
	{ params }: { params: Promise<{ token: string }> },
) {
	try {
		const session = await requireSession();
		const { token } = await params;

		const [invite] = await db
			.select()
			.from(secretaryInvite)
			.where(
				and(
					eq(secretaryInvite.tokenHash, hashInviteToken(token)),
					isNull(secretaryInvite.acceptedAt),
					gt(secretaryInvite.expiresAt, new Date()),
				),
			);
		if (!invite) return apiError("INVITE_NOT_FOUND");

		if (session.user.email.trim().toLowerCase() !== invite.email) {
			return apiError("INVITE_EMAIL_MISMATCH");
		}

		const [[ownProfile], [membership]] = await Promise.all([
			db
				.select({ id: doctorProfile.id })
				.from(doctorProfile)
				.where(eq(doctorProfile.userId, session.user.id)),
			db
				.select({ id: secretary.id })
				.from(secretary)
				.where(eq(secretary.userId, session.user.id)),
		]);
		if (ownProfile || membership) return apiError("ALREADY_IN_PRACTICE");

		const { plan } = await getEffectivePlan(invite.doctorId);
		if (!plan.canHaveSecretaries) return apiError("SECRETARY_ACCESS_PAUSED");

		await db.transaction(async (tx) => {
			await tx
				.insert(secretary)
				.values({ doctorId: invite.doctorId, userId: session.user.id });
			await tx
				.update(secretaryInvite)
				.set({ acceptedAt: new Date() })
				.where(eq(secretaryInvite.id, invite.id));
		});

		return json({ ok: true });
	} catch (e) {
		if (e instanceof Response) return e;
		return apiError("INTERNAL_ERROR");
	}
}

import { registry } from "@/lib/openapi";

registry.registerPath({
	method: "post",
	path: "/api/secretary-invites/{token}/accept",
	tags: ["Team"],
	summary: "Accept a secretary invite",
	request: { params: z.object({ token: z.string() }) },
	responses: {
		200: {
			description: "Joined the practice",
			content: {
				"application/json": { schema: z.object({ ok: z.boolean() }) },
			},
		},
	},
});
