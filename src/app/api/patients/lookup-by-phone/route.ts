import type { NextRequest } from "next/server";
import { z } from "zod";
import {
	apiError,
	json,
	requireDoctorProfile,
	requireSession,
	validationError,
} from "@/lib/api-utils";
import { findDoctorPatientByPhone } from "@/lib/appointment-patient-link";
import { registry } from "@/lib/openapi";
import { normalizePhoneForStorage } from "@/lib/phone";

const querySchema = z.object({
	phone: z.string().min(1),
});

export async function GET(req: NextRequest) {
	try {
		const session = await requireSession();
		const profile = await requireDoctorProfile(session.user.id);
		const parsed = querySchema.safeParse(
			Object.fromEntries(req.nextUrl.searchParams),
		);

		if (!parsed.success) return validationError(parsed.error.issues);

		const normalized = normalizePhoneForStorage(parsed.data.phone);
		if (!normalized)
			return validationError([
				{ message: "Invalid phone number", path: ["phone"] },
			]);

		const matched = await findDoctorPatientByPhone(profile.id, normalized);

		return json({
			phone: normalized,
			matchedPatient: matched
				? {
						id: matched.id,
						firstName: matched.firstName,
						lastName: matched.lastName,
						cin: matched.cin,
						phoneNumber: matched.phoneNumber,
					}
				: null,
		});
	} catch (e) {
		if (e instanceof Response) return e;
		return apiError("INTERNAL_ERROR");
	}
}

const lookupResponseSchema = z.object({
	phone: z.string(),
	matchedPatient: z
		.object({
			id: z.number().int(),
			firstName: z.string().nullable(),
			lastName: z.string().nullable(),
			cin: z.string().nullable(),
			phoneNumber: z.string().nullable(),
		})
		.nullable(),
});

registry.registerPath({
	method: "get",
	path: "/api/patients/lookup-by-phone",
	tags: ["Patients"],
	summary: "Find doctor patient by phone number",
	request: { query: querySchema },
	responses: {
		200: {
			description: "Lookup result",
			content: {
				"application/json": { schema: lookupResponseSchema },
			},
		},
	},
});
