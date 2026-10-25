import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { review } from "@/db/schema";
import { apiError, json } from "@/lib/api-utils";
import { registry } from "@/lib/openapi";

const paramsSchema = z.object({ token: z.string().uuid() });

const reviewVisitSchema = z.object({
	status: z.enum(["pending", "submitted", "expired"]),
	patientFirstName: z.string().nullable(),
	doctorName: z.string().nullable(),
	speciality: z.string().nullable(),
	cabinetName: z.string().nullable(),
	city: z.string().nullable(),
	start: z.string().datetime().nullable(),
	end: z.string().datetime().nullable(),
});

// ─── GET /api/reviews/[token] ────────────────────────────────────────────────
// Public (magic link): the visit being rated, so the patient knows which one.
// No reason or medical details: the link may be forwarded.

export async function GET(
	_req: NextRequest,
	{ params }: { params: Promise<{ token: string }> },
) {
	try {
		const parsedParams = paramsSchema.safeParse(await params);
		if (!parsedParams.success) return apiError("REVIEW_NOT_FOUND");

		const row = await db.query.review.findFirst({
			where: eq(review.token, parsedParams.data.token),
			with: {
				appointment: { columns: { start: true, end: true } },
				patient: { columns: { firstName: true } },
				doctor: {
					columns: { firstName: true, lastName: true, cabinetName: true },
					with: {
						speciality: { columns: { enName: true } },
						cabinetCity: { columns: { enName: true } },
					},
				},
			},
		});
		if (!row) return apiError("REVIEW_NOT_FOUND");

		const { appointment, patient, doctor } = row;
		const doctorName =
			[doctor.firstName, doctor.lastName].filter(Boolean).join(" ") || null;
		const status =
			row.status === "submitted"
				? "submitted"
				: row.expiresAt.getTime() < Date.now()
					? "expired"
					: "pending";

		return json({
			status,
			patientFirstName: patient?.firstName ?? null,
			doctorName,
			speciality: doctor.speciality?.enName ?? null,
			cabinetName: doctor.cabinetName,
			city: doctor.cabinetCity?.enName ?? null,
			start: appointment.start?.toISOString() ?? null,
			end: appointment.end?.toISOString() ?? null,
		} satisfies z.infer<typeof reviewVisitSchema>);
	} catch (e) {
		if (e instanceof Response) return e;
		console.error("Failed to load review:", e);
		return apiError("INTERNAL_ERROR");
	}
}

registry.registerPath({
	method: "get",
	path: "/api/reviews/{token}",
	tags: ["Reviews"],
	summary: "Get the visit a review link is for",
	request: { params: z.object({ token: z.string() }) },
	responses: {
		200: {
			description: "The visit and whether the review can still be submitted",
			content: { "application/json": { schema: reviewVisitSchema } },
		},
	},
});
