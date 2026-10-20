import { eq } from "drizzle-orm";
import { db } from "@/db";
import { user as userTable } from "@/db/auth-schema";
import { doctorProfile, secretary } from "@/db/schema";
import { apiError, json, requireSession } from "@/lib/api-utils";
import type { Availability } from "@/lib/doctor-slots";
import { getEffectivePlan } from "@/lib/plan-limits";
import { doctorTitle } from "@/lib/secretaries";

// ─── GET /api/users/me ───────────────────────────────────────────────────────
// Authenticated user: same shape as GET /api/users/[id] for the current session user,
// plus `practice`: the practice they work in as its doctor or as a secretary.

async function getPractice(
	userId: string,
	own: { id: number; availability: Availability | null } | undefined,
) {
	if (own) {
		return {
			role: "doctor" as const,
			doctorId: own.id,
			doctorName: null,
			availability: own.availability,
			active: true,
		};
	}
	const row = await db.query.secretary.findFirst({
		where: eq(secretary.userId, userId),
		with: { doctor: true },
	});
	if (!row) return null;
	const { plan } = await getEffectivePlan(row.doctorId);
	return {
		role: "secretary" as const,
		doctorId: row.doctorId,
		doctorName: doctorTitle(row.doctor),
		availability: row.doctor.availability,
		active: row.doctor.status === "verified" && plan.canHaveSecretaries,
	};
}

/** Which admin excluded the doctor stays admin-side. */
function withoutExcludedBy<T extends { bestFitExcludedBy: string | null }>(
	profile: T,
): Omit<T, "bestFitExcludedBy"> {
	const { bestFitExcludedBy: _excludedBy, ...rest } = profile;
	return rest;
}

export async function GET() {
	try {
		const session = await requireSession();
		const id = session.user.id;

		const [foundUser] = await db
			.select({
				id: userTable.id,
				name: userTable.name,
				email: userTable.email,
				image: userTable.image,
				displayName: userTable.displayName,
				username: userTable.username,
				accessId: userTable.accessId,
				active: userTable.active,
				type: userTable.type,
				createdAt: userTable.createdAt,
			})
			.from(userTable)
			.where(eq(userTable.id, id));

		if (!foundUser) return apiError("USER_NOT_FOUND");

		const doctorProfileData = await db.query.doctorProfile.findFirst({
			where: eq(doctorProfile.userId, id),
			with: { speciality: true, cabinetCity: true },
		});

		const practice = await getPractice(id, doctorProfileData);

		return json({
			...foundUser,
			doctorProfile: doctorProfileData
				? withoutExcludedBy(doctorProfileData)
				: null,
			practice,
		});
	} catch (e) {
		if (e instanceof Response) return e;
		return apiError("INTERNAL_ERROR");
	}
}

import { z } from "zod";
import {
	availabilitySchema,
	selectUserWithDoctorProfileSchema,
} from "@/db/zod";
import { registry } from "@/lib/openapi";

registry.registerPath({
	method: "get",
	path: "/api/users/me",
	tags: ["Users"],
	summary: "Get current user profile",
	responses: {
		200: {
			description: "Current user profile",
			content: {
				"application/json": {
					schema: selectUserWithDoctorProfileSchema.merge(
						z.object({
							practice: z
								.object({
									role: z.enum(["doctor", "secretary"]),
									doctorId: z.number(),
									/** Set for secretaries */
									doctorName: z.string().nullable(),
									/** The practice's weekly hours */
									availability: availabilitySchema.nullable(),
									/** False while the doctor's plan doesn't include secretaries */
									active: z.boolean(),
								})
								.nullable(),
						}),
					),
				},
			},
		},
	},
});
