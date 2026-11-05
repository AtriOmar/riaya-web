import type { NextRequest } from "next/server";
import {
	apiError,
	json,
	requireDoctorProfile,
	requireSession,
	validationError,
} from "@/lib/api-utils";
import {
	cabinetAddressResponseSchema,
	cabinetAddressSchema,
	setCabinetAddress,
} from "@/lib/cabinet-address";
import { registry } from "@/lib/openapi";

// ─── PUT /api/doctors/me/address ──────────────────────────────────────────────
// The doctor corrects the written address of their own cabinet. The pin and the
// city are not touched.

export async function PUT(req: NextRequest) {
	try {
		const session = await requireSession();
		const profile = await requireDoctorProfile(session.user.id);

		const parsed = cabinetAddressSchema.safeParse(await req.json());
		if (!parsed.success) return validationError(parsed.error.issues);

		const updated = await setCabinetAddress(
			profile.id,
			parsed.data.cabinetAddress,
		);
		if (!updated) return apiError("DOCTOR_PROFILE_NOT_FOUND");
		return json(updated);
	} catch (e) {
		if (e instanceof Response) return e;
		return apiError("INTERNAL_ERROR");
	}
}

registry.registerPath({
	method: "put",
	path: "/api/doctors/me/address",
	tags: ["Doctors"],
	summary: "Update the address of the doctor's own cabinet",
	request: {
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
