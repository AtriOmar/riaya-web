import { and, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { user } from "@/db/auth-schema";
import { doctorProfile, secretary, secretaryInvite } from "@/db/schema";
import {
	apiError,
	json,
	requireDoctorProfile,
	requireSession,
	validationError,
} from "@/lib/api-utils";
import { sendSecretaryInviteEmail } from "@/lib/mailer";
import { getEffectivePlan } from "@/lib/plan-limits";
import {
	doctorTitle,
	inviteUrl,
	newInviteToken,
	openInviteFilter,
	SECRETARY_INVITE_TTL_DAYS,
} from "@/lib/secretaries";

// ─── POST /api/secretaries/invites ────────────────────────────────────────────
// Invites someone by email to join the practice as a secretary (Pro). Inviting
// an email that already has an open invite sends a fresh link instead.
// The link is also returned so the doctor can share it another way.

const inviteSchema = z.object({
	email: z.email().transform((e) => e.trim().toLowerCase()),
});

export async function POST(req: NextRequest) {
	try {
		const session = await requireSession();
		const profile = await requireDoctorProfile(session.user.id);

		const parsed = inviteSchema.safeParse(await req.json());
		if (!parsed.success) return validationError(parsed.error.issues);
		const { email } = parsed.data;

		const { plan } = await getEffectivePlan(profile.id);
		if (profile.status !== "verified" || !plan.canHaveSecretaries) {
			return apiError("SECRETARIES_REQUIRE_PRO");
		}

		// Someone who already works in a practice (or runs one) can't join
		const [existingUser] = await db
			.select({
				doctorId: doctorProfile.id,
				secretaryId: secretary.id,
			})
			.from(user)
			.leftJoin(doctorProfile, eq(doctorProfile.userId, user.id))
			.leftJoin(secretary, eq(secretary.userId, user.id))
			.where(eq(user.email, email));
		if (existingUser?.doctorId || existingUser?.secretaryId) {
			return apiError("ALREADY_IN_PRACTICE");
		}

		const [pending] = await db
			.select({ id: secretaryInvite.id })
			.from(secretaryInvite)
			.where(
				and(openInviteFilter(profile.id), eq(secretaryInvite.email, email)),
			);

		const { token, tokenHash } = newInviteToken();
		const expiresAt = new Date(
			Date.now() + SECRETARY_INVITE_TTL_DAYS * 24 * 60 * 60 * 1000,
		);

		const [invite] = pending
			? await db
					.update(secretaryInvite)
					.set({ tokenHash, expiresAt })
					.where(eq(secretaryInvite.id, pending.id))
					.returning()
			: await db
					.insert(secretaryInvite)
					.values({ doctorId: profile.id, email, tokenHash, expiresAt })
					.returning();

		const url = inviteUrl(token);
		let emailSent = true;
		try {
			await sendSecretaryInviteEmail({
				to: email,
				doctorName: doctorTitle(profile),
				inviteUrl: url,
				expiresInDays: SECRETARY_INVITE_TTL_DAYS,
			});
		} catch (err) {
			console.error("[secretaries/invites] email failed:", err);
			emailSent = false;
		}

		return json(
			{
				invite: {
					id: invite.id,
					email: invite.email,
					expiresAt: invite.expiresAt,
					createdAt: invite.createdAt,
				},
				inviteUrl: url,
				emailSent,
			},
			201,
		);
	} catch (e) {
		if (e instanceof Response) return e;
		return apiError("INTERNAL_ERROR");
	}
}

import { registry } from "@/lib/openapi";

registry.registerPath({
	method: "post",
	path: "/api/secretaries/invites",
	tags: ["Team"],
	summary: "Invite a secretary by email",
	request: {
		body: { content: { "application/json": { schema: inviteSchema } } },
	},
	responses: {
		201: {
			description: "The invite, its link, and whether the email went out",
			content: {
				"application/json": {
					schema: z.object({
						invite: z.object({
							id: z.number(),
							email: z.string(),
							expiresAt: z.string(),
							createdAt: z.string(),
						}),
						inviteUrl: z.string(),
						emailSent: z.boolean(),
					}),
				},
			},
		},
	},
});
