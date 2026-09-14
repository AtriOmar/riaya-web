import type { NextRequest } from "next/server";
import { z } from "zod";
import { json, requireInternal, validationError } from "@/lib/api-utils";
import { listAiAppointmentsForCaller } from "@/lib/caller-ai-appointments";
import { apiError } from "@/lib/errors";
import { registry } from "@/lib/openapi";

const bodySchema = z.object({
	phoneNumber: z.string().min(1),
	includeRecentPast: z.boolean().optional(),
});

const appointmentItemSchema = z.object({
	appointmentId: z.number().int(),
	status: z.string().nullable(),
	start: z.string().nullable(),
	end: z.string().nullable(),
	name: z.string().nullable(),
	description: z.string().nullable(),
	doctorName: z.string(),
	cabinetName: z.string().nullable(),
	address: z.string().nullable(),
});

const listResponseSchema = z.object({
	upcoming: z.array(appointmentItemSchema),
	recentPast: z.array(appointmentItemSchema),
});

export async function POST(req: NextRequest) {
	try {
		await requireInternal(req);
		const parsed = bodySchema.safeParse(await req.json());
		if (!parsed.success) return validationError(parsed.error.issues);

		const result = await listAiAppointmentsForCaller(parsed.data.phoneNumber, {
			includeRecentPast: parsed.data.includeRecentPast,
		});
		return json(result);
	} catch (e) {
		if (e instanceof Response) return e;
		return apiError("INTERNAL_ERROR");
	}
}

registry.registerPath({
	method: "post",
	path: "/api/internal/caller/ai-appointments/list",
	tags: ["Caller"],
	summary: "List AI appointments for caller phone (voice service)",
	request: {
		body: { content: { "application/json": { schema: bodySchema } } },
	},
	responses: {
		200: {
			description: "Upcoming and recent past AI appointments",
			content: { "application/json": { schema: listResponseSchema } },
		},
	},
});
