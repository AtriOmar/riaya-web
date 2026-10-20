import type { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, json, validationError } from "@/lib/api-utils";
import { findDoctorPatientByPerson } from "@/lib/appointment-patient-link";
import { registry } from "@/lib/openapi";
import { requirePractice } from "@/lib/practice";

// ─── GET /api/patients/lookup-by-person ──────────────────────────────────────
// The doctor's existing patient file for a person (e.g. before accepting a phone booking).

const querySchema = z.object({
	personId: z.coerce.number().int().positive(),
});

export async function GET(req: NextRequest) {
	try {
		const { doctor: profile } = await requirePractice();
		const parsed = querySchema.safeParse(
			Object.fromEntries(req.nextUrl.searchParams),
		);

		if (!parsed.success) return validationError(parsed.error.issues);

		const matched = await findDoctorPatientByPerson(
			profile.id,
			parsed.data.personId,
		);

		return json({
			matchedPatient: matched
				? {
						id: matched.id,
						firstName: matched.firstName,
						lastName: matched.lastName,
						cin: matched.cin,
					}
				: null,
		});
	} catch (e) {
		if (e instanceof Response) return e;
		return apiError("INTERNAL_ERROR");
	}
}

const lookupResponseSchema = z.object({
	matchedPatient: z
		.object({
			id: z.number().int(),
			firstName: z.string().nullable(),
			lastName: z.string().nullable(),
			cin: z.string().nullable(),
		})
		.nullable(),
});

registry.registerPath({
	method: "get",
	path: "/api/patients/lookup-by-person",
	tags: ["Patients"],
	summary: "Find the doctor's patient file for a person",
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
