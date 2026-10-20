import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { doctorProfile } from "@/db/schema";
import {
	apiError,
	json,
	requireDoctorProfile,
	requireSession,
	validationError,
} from "@/lib/api-utils";
import { isCdnUrl } from "@/lib/document-branding";
import { getEffectivePlan } from "@/lib/plan-limits";

// ─── PUT /api/doctors/me/branding ─────────────────────────────────────────────
// Sets the logo and stamp printed on the doctor's invoices (Pro). Images are
// uploaded to R2 first; `null` removes one. Removing is allowed on any plan.

const brandingSchema = z.object({
	logoUrl: z.url().nullable(),
	stampUrl: z.url().nullable(),
});

const brandingResponseSchema = brandingSchema;

export async function PUT(req: NextRequest) {
	try {
		const session = await requireSession();
		const profile = await requireDoctorProfile(session.user.id);

		const parsed = brandingSchema.safeParse(await req.json());
		if (!parsed.success) return validationError(parsed.error.issues);
		const { logoUrl, stampUrl } = parsed.data;

		const adds =
			(logoUrl != null && logoUrl !== profile.logoUrl) ||
			(stampUrl != null && stampUrl !== profile.stampUrl);
		if (adds) {
			const { plan } = await getEffectivePlan(profile.id);
			if (!plan.canBrandDocuments) {
				return apiError("DOCUMENT_BRANDING_REQUIRES_PRO");
			}
		}
		if ([logoUrl, stampUrl].some((url) => url != null && !isCdnUrl(url))) {
			return apiError("INVALID_BRANDING_IMAGE");
		}

		const [updated] = await db
			.update(doctorProfile)
			.set({ logoUrl, stampUrl, updatedAt: new Date() })
			.where(eq(doctorProfile.id, profile.id))
			.returning({
				logoUrl: doctorProfile.logoUrl,
				stampUrl: doctorProfile.stampUrl,
			});

		return json(updated);
	} catch (e) {
		if (e instanceof Response) return e;
		return apiError("INTERNAL_ERROR");
	}
}

import { registry } from "@/lib/openapi";

registry.registerPath({
	method: "put",
	path: "/api/doctors/me/branding",
	tags: ["Doctors"],
	summary: "Set the logo and stamp printed on invoices",
	request: {
		body: { content: { "application/json": { schema: brandingSchema } } },
	},
	responses: {
		200: {
			description: "Saved branding",
			content: { "application/json": { schema: brandingResponseSchema } },
		},
	},
});
