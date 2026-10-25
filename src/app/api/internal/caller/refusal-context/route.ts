import type { NextRequest } from "next/server";
import { z } from "zod";
import {
	apiError,
	json,
	requireInternal,
	validationError,
} from "@/lib/api-utils";
import { registry } from "@/lib/openapi";
import { getRefusalContext } from "@/lib/refusal-suggestions";

const bodySchema = z.object({
	phoneNumber: z.string().min(1),
});

const suggestionSchema = z.object({
	doctorId: z.number().int(),
	name: z.string(),
	cabinetName: z.string().nullable(),
	address: z.string().nullable(),
	distanceKm: z.number(),
	slotStart: z.string(),
	slotEnd: z.string(),
});

const responseSchema = z.object({
	found: z.boolean(),
	refusedDoctorName: z.string().nullable(),
	suggestions: z.array(suggestionSchema),
	/** Who the refused request was for: someone on the calling phone. */
	patient: z
		.object({
			personId: z.number().int(),
			firstName: z.string().nullable(),
			lastName: z.string().nullable(),
		})
		.nullable(),
	/** The reason for the visit given in the refused request. */
	illness: z.string().nullable(),
});

// ─── POST /api/internal/caller/refusal-context ────────────────────────────────
// Voice service: did a doctor recently refuse this caller's request? If so,
// return other doctors (fresh slots) to offer on the call.

export async function POST(req: NextRequest) {
	try {
		requireInternal(req);
		const parsed = bodySchema.safeParse(await req.json());
		if (!parsed.success) return validationError(parsed.error.issues);

		const context = await getRefusalContext(parsed.data.phoneNumber);
		if (!context) {
			return json({
				found: false,
				refusedDoctorName: null,
				suggestions: [],
				patient: null,
				illness: null,
			});
		}
		return json({
			found: true,
			refusedDoctorName: context.refusedDoctorName || null,
			suggestions: context.suggestions,
			patient: context.patient,
			illness: context.illness,
		});
	} catch (e) {
		if (e instanceof Response) return e;
		return apiError("INTERNAL_ERROR");
	}
}

registry.registerPath({
	method: "post",
	path: "/api/internal/caller/refusal-context",
	tags: ["Caller"],
	summary: "Alternative doctors after a refused request (voice service)",
	request: {
		body: { content: { "application/json": { schema: bodySchema } } },
	},
	responses: {
		200: {
			description: "Refusal context for the caller phone",
			content: { "application/json": { schema: responseSchema } },
		},
	},
});
