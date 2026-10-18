import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { user } from "@/db/auth-schema";
import { secretary, secretaryInvite } from "@/db/schema";
import {
	apiError,
	json,
	requireDoctorProfile,
	requireSession,
} from "@/lib/api-utils";
import { getEffectivePlan } from "@/lib/plan-limits";
import { openInviteFilter } from "@/lib/secretaries";

// ─── GET /api/secretaries ─────────────────────────────────────────────────────
// The doctor's secretaries, invites still waiting for an answer, and whether
// their plan includes secretaries.

export async function GET() {
	try {
		const session = await requireSession();
		const profile = await requireDoctorProfile(session.user.id);

		const [members, invites, { plan }] = await Promise.all([
			db
				.select({
					id: secretary.id,
					name: user.name,
					email: user.email,
					image: user.image,
					createdAt: secretary.createdAt,
				})
				.from(secretary)
				.innerJoin(user, eq(user.id, secretary.userId))
				.where(eq(secretary.doctorId, profile.id))
				.orderBy(asc(secretary.createdAt)),
			db
				.select({
					id: secretaryInvite.id,
					email: secretaryInvite.email,
					expiresAt: secretaryInvite.expiresAt,
					createdAt: secretaryInvite.createdAt,
				})
				.from(secretaryInvite)
				.where(openInviteFilter(profile.id))
				.orderBy(asc(secretaryInvite.createdAt)),
			getEffectivePlan(profile.id),
		]);

		return json({
			secretaries: members,
			invites,
			canHaveSecretaries: plan.canHaveSecretaries,
		});
	} catch (e) {
		if (e instanceof Response) return e;
		return apiError("INTERNAL_ERROR");
	}
}

import { registry } from "@/lib/openapi";

registry.registerPath({
	method: "get",
	path: "/api/secretaries",
	tags: ["Team"],
	summary: "List the doctor's secretaries and open invites",
	responses: {
		200: {
			description:
				"Secretaries, open invites and whether the plan includes them",
			content: {
				"application/json": {
					schema: z.object({
						secretaries: z.array(
							z.object({
								id: z.number(),
								name: z.string(),
								email: z.string(),
								image: z.string().nullable(),
								createdAt: z.string(),
							}),
						),
						invites: z.array(
							z.object({
								id: z.number(),
								email: z.string(),
								expiresAt: z.string(),
								createdAt: z.string(),
							}),
						),
						canHaveSecretaries: z.boolean(),
					}),
				},
			},
		},
	},
});
