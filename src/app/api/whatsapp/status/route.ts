import axios from "axios";
import { z } from "zod";
import { apiError, json } from "@/lib/api-utils";
import { registry } from "@/lib/openapi";
import { requirePractice } from "@/lib/practice";
import { getRealtimeHttpUrl } from "@/lib/realtime";
import { signRealtimeTicket } from "@/lib/realtime-ticket";

const whatsappStatusSchema = z.object({
	/** `null` when the voice service can't be reached, so the state is unknown. */
	connected: z.boolean().nullable(),
});

// ─── GET /api/whatsapp/status ─────────────────────────────────────────────────
// Whether the practice doctor's WhatsApp is linked. Messages go out from the
// doctor's number, so a secretary gets the doctor's state.

export async function GET() {
	try {
		const { doctor } = await requirePractice();

		const httpUrl = getRealtimeHttpUrl();
		if (!httpUrl) return json({ connected: null });

		try {
			const { data } = await axios.get<{ connected: boolean }>(
				`${httpUrl}/whatsapp-status`,
				{
					headers: {
						Authorization: `Bearer ${signRealtimeTicket({
							scope: "whatsapp",
							userId: doctor.userId,
						})}`,
					},
					timeout: 5000,
				},
			);
			return json({ connected: data.connected });
		} catch {
			return json({ connected: null });
		}
	} catch (e) {
		if (e instanceof Response) return e;
		return apiError("INTERNAL_ERROR");
	}
}

registry.registerPath({
	method: "get",
	path: "/api/whatsapp/status",
	tags: ["WhatsApp"],
	summary: "Whether the practice's WhatsApp is connected",
	responses: {
		200: {
			description: "Connection state",
			content: { "application/json": { schema: whatsappStatusSchema } },
		},
	},
});
