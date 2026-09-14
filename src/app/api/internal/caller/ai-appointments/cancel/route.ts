import type { NextRequest } from "next/server";
import { z } from "zod";
import { json, requireInternal, validationError } from "@/lib/api-utils";
import { cancelPendingAiAppointmentForCaller } from "@/lib/caller-ai-appointments";
import { apiError } from "@/lib/errors";
import { registry } from "@/lib/openapi";

const bodySchema = z.object({
	phoneNumber: z.string().min(1),
	appointmentId: z.number().int().positive(),
});

const cancelResponseSchema = z.object({
	success: z.literal(true),
	appointmentId: z.number().int(),
	status: z.string().nullable(),
});

export async function POST(req: NextRequest) {
	try {
		await requireInternal(req);
		const parsed = bodySchema.safeParse(await req.json());
		if (!parsed.success) return validationError(parsed.error.issues);

		const updated = await cancelPendingAiAppointmentForCaller(
			parsed.data.appointmentId,
			parsed.data.phoneNumber,
		);

		return json({
			success: true as const,
			appointmentId: updated.id,
			status: updated.status,
		});
	} catch (e) {
		if (e instanceof Response) return e;
		return apiError("INTERNAL_ERROR");
	}
}

registry.registerPath({
	method: "post",
	path: "/api/internal/caller/ai-appointments/cancel",
	tags: ["Caller"],
	summary: "Cancel pending AI appointment for caller phone (voice service)",
	request: {
		body: { content: { "application/json": { schema: bodySchema } } },
	},
	responses: {
		200: {
			description: "Appointment cancelled",
			content: { "application/json": { schema: cancelResponseSchema } },
		},
	},
});
