import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { doctorProfile } from "@/db/schema";
import { apiError, json, requireAdmin, validationError } from "@/lib/api-utils";
import { registry } from "@/lib/openapi";

const paramsSchema = z.object({ id: z.coerce.number().int().positive() });

const responseSchema = z.object({
	exclusion: z
		.object({ excludedAt: z.string(), reason: z.string() })
		.nullable(),
});

// ─── POST /api/doctors/[id]/best-fit-exclusion ───────────────────────────────
// Admin-only: stop referring patients to this doctor (best-fit, emergency
// fan-out, refusal suggestions). The doctor sees the reason on their dashboard.

const excludeSchema = z.object({
	reason: z.string().trim().min(1).max(1000),
});

export async function POST(
	req: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	try {
		const session = await requireAdmin();
		const parsedParams = paramsSchema.safeParse(await params);
		if (!parsedParams.success) return apiError("INVALID_ID");

		const parsed = excludeSchema.safeParse(await req.json());
		if (!parsed.success) return validationError(parsed.error.issues);

		const excludedAt = new Date();
		const [updated] = await db
			.update(doctorProfile)
			.set({
				bestFitExcludedAt: excludedAt,
				bestFitExcludedBy: session.user.id,
				bestFitExcludedReason: parsed.data.reason,
				updatedAt: excludedAt,
			})
			.where(eq(doctorProfile.id, parsedParams.data.id))
			.returning({ id: doctorProfile.id });
		if (!updated) return apiError("DOCTOR_NOT_FOUND");

		return json({
			exclusion: {
				excludedAt: excludedAt.toISOString(),
				reason: parsed.data.reason,
			},
		});
	} catch (e) {
		if (e instanceof Response) return e;
		return apiError("INTERNAL_ERROR");
	}
}

// ─── DELETE /api/doctors/[id]/best-fit-exclusion ─────────────────────────────
// Admin-only: list the doctor for referrals again.

export async function DELETE(
	_req: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	try {
		await requireAdmin();
		const parsedParams = paramsSchema.safeParse(await params);
		if (!parsedParams.success) return apiError("INVALID_ID");

		const [updated] = await db
			.update(doctorProfile)
			.set({
				bestFitExcludedAt: null,
				bestFitExcludedBy: null,
				bestFitExcludedReason: null,
				updatedAt: new Date(),
			})
			.where(eq(doctorProfile.id, parsedParams.data.id))
			.returning({ id: doctorProfile.id });
		if (!updated) return apiError("DOCTOR_NOT_FOUND");

		return json({ exclusion: null });
	} catch (e) {
		if (e instanceof Response) return e;
		return apiError("INTERNAL_ERROR");
	}
}

registry.registerPath({
	method: "post",
	path: "/api/doctors/{id}/best-fit-exclusion",
	tags: ["Ratings"],
	summary: "Exclude a doctor from patient referrals (Admin)",
	request: {
		params: z.object({ id: z.string() }),
		body: { content: { "application/json": { schema: excludeSchema } } },
	},
	responses: {
		200: {
			description: "The doctor's new exclusion state",
			content: { "application/json": { schema: responseSchema } },
		},
	},
});

registry.registerPath({
	method: "delete",
	path: "/api/doctors/{id}/best-fit-exclusion",
	tags: ["Ratings"],
	summary: "List a doctor for patient referrals again (Admin)",
	request: { params: z.object({ id: z.string() }) },
	responses: {
		200: {
			description: "The doctor's new exclusion state",
			content: { "application/json": { schema: responseSchema } },
		},
	},
});
