import { and, eq, gt, isNull } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { doctorProfile, secretaryInvite } from "@/db/schema";
import { apiError, json } from "@/lib/api-utils";
import { doctorTitle, hashInviteToken } from "@/lib/secretaries";

// ─── GET /api/secretary-invites/[token] ───────────────────────────────────────
// Public: what the join page shows before the person signs in.

export async function GET(
	_req: NextRequest,
	{ params }: { params: Promise<{ token: string }> },
) {
	try {
		const { token } = await params;
		const [row] = await db
			.select({
				email: secretaryInvite.email,
				doctor: doctorProfile,
			})
			.from(secretaryInvite)
			.innerJoin(doctorProfile, eq(doctorProfile.id, secretaryInvite.doctorId))
			.where(
				and(
					eq(secretaryInvite.tokenHash, hashInviteToken(token)),
					isNull(secretaryInvite.acceptedAt),
					gt(secretaryInvite.expiresAt, new Date()),
				),
			);
		if (!row) return apiError("INVITE_NOT_FOUND");

		return json({
			email: row.email,
			doctorName: doctorTitle(row.doctor),
			cabinetName: row.doctor.cabinetName,
		});
	} catch (e) {
		if (e instanceof Response) return e;
		return apiError("INTERNAL_ERROR");
	}
}

import { registry } from "@/lib/openapi";

registry.registerPath({
	method: "get",
	path: "/api/secretary-invites/{token}",
	tags: ["Team"],
	summary: "Look up a secretary invite",
	request: { params: z.object({ token: z.string() }) },
	responses: {
		200: {
			description: "Who sent the invite and to which email",
			content: {
				"application/json": {
					schema: z.object({
						email: z.string(),
						doctorName: z.string(),
						cabinetName: z.string().nullable(),
					}),
				},
			},
		},
	},
});
