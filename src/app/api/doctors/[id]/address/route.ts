import type { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, json, requireAdmin, validationError } from "@/lib/api-utils";
import {
	cabinetAddressResponseSchema,
	cabinetAddressSchema,
	setCabinetAddress,
} from "@/lib/cabinet-address";
import { registry } from "@/lib/openapi";

// ─── PUT /api/doctors/[id]/address ────────────────────────────────────────────
// Admin-only. Sets the written address of a doctor's cabinet. The pin and the
// city are not touched.

export async function PUT(
	req: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	try {
		await requireAdmin();
		const { id } = await params;
		const numericId = Number(id);
		if (!Number.isFinite(numericId)) return apiError("INVALID_ID");

		const parsed = cabinetAddressSchema.safeParse(await req.json());
		if (!parsed.success) return validationError(parsed.error.issues);

		const updated = await setCabinetAddress(
			numericId,
			parsed.data.cabinetAddress,
		);
		if (!updated) return apiError("DOCTOR_NOT_FOUND");
		return json(updated);
	} catch (e) {
		if (e instanceof Response) return e;
		return apiError("INTERNAL_ERROR");
	}
}

registry.registerPath({
	method: "put",
	path: "/api/doctors/{id}/address",
	tags: ["Doctors"],
	summary: "Update a doctor's cabinet address (Admin)",
	request: {
		params: z.object({ id: z.string() }),
		body: { content: { "application/json": { schema: cabinetAddressSchema } } },
	},
	responses: {
		200: {
			description: "Saved address",
			content: {
				"application/json": { schema: cabinetAddressResponseSchema },
			},
		},
	},
});
