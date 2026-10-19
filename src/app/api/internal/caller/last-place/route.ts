import { and, desc, eq, isNotNull } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { appointment } from "@/db/schema";
import {
	apiError,
	json,
	requireInternal,
	validationError,
} from "@/lib/api-utils";
import { registry } from "@/lib/openapi";
import { normalizePhoneForStorage } from "@/lib/phone";

// ─── POST /api/internal/caller/last-place ────────────────────────────────────
// Voice service: the place the caller searched from on their last phone
// booking, so the assistant can offer the same area instead of asking again.

const bodySchema = z.object({
	phoneNumber: z.string().min(1),
});

const responseSchema = z.object({
	found: z.boolean(),
	label: z.string().nullable(),
	latitude: z.number().nullable(),
	longitude: z.number().nullable(),
});

export async function POST(req: NextRequest) {
	try {
		requireInternal(req);
		const parsed = bodySchema.safeParse(await req.json());
		if (!parsed.success) return validationError(parsed.error.issues);

		const phone = normalizePhoneForStorage(parsed.data.phoneNumber);
		if (!phone)
			return validationError([
				{ message: "Invalid phone number", path: ["phoneNumber"] },
			]);

		const [last] = await db
			.select({
				label: appointment.patientPlaceLabel,
				latitude: appointment.patientLatitude,
				longitude: appointment.patientLongitude,
			})
			.from(appointment)
			.where(
				and(
					eq(appointment.contactPhone, phone),
					eq(appointment.source, "ai"),
					isNotNull(appointment.patientLatitude),
					isNotNull(appointment.patientLongitude),
				),
			)
			.orderBy(desc(appointment.createdAt))
			.limit(1);

		if (!last)
			return json({
				found: false,
				label: null,
				latitude: null,
				longitude: null,
			});
		return json({ found: true, ...last });
	} catch (e) {
		if (e instanceof Response) return e;
		return apiError("INTERNAL_ERROR");
	}
}

registry.registerPath({
	method: "post",
	path: "/api/internal/caller/last-place",
	tags: ["Caller"],
	summary: "Place of the caller's last phone booking (voice service)",
	request: {
		body: { content: { "application/json": { schema: bodySchema } } },
	},
	responses: {
		200: {
			description: "The last place this phone line booked from",
			content: { "application/json": { schema: responseSchema } },
		},
	},
});
