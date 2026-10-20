import { z } from "zod";
import { apiError, json, requireAdmin, validationError } from "@/lib/api-utils";
import { saveCallSettings } from "@/lib/call-settings";
import { callSettingsSchema } from "@/lib/call-settings-schema";

// ─── POST /api/test-call/settings ─────────────────────────────────────────────
// Admin-only: stores the model choices for one simulated call. The voice
// server reads them (by callSid) when the call connects. Only simulated
// `CA_SIM*` call ids are accepted, so real calls can never be affected.

const bodySchema = z.object({
	callSid: z.string().startsWith("CA_SIM"),
	settings: callSettingsSchema,
});

const responseSchema = z.object({ ok: z.boolean() });

export async function POST(req: Request) {
	try {
		await requireAdmin();

		const parsed = bodySchema.safeParse(await req.json());
		if (!parsed.success) return validationError(parsed.error.issues);

		await saveCallSettings(parsed.data.callSid, parsed.data.settings);
		return json({ ok: true });
	} catch (e) {
		if (e instanceof Response) return e;
		return apiError("INTERNAL_ERROR");
	}
}

import { registry } from "@/lib/openapi";

registry.registerPath({
	method: "post",
	path: "/api/test-call/settings",
	tags: ["TestCall"],
	summary: "Save per-call model settings for a test call (Admin)",
	request: {
		body: {
			content: {
				"application/json": {
					schema: bodySchema,
				},
			},
		},
	},
	responses: {
		200: {
			description: "Settings stored",
			content: {
				"application/json": {
					schema: responseSchema,
				},
			},
		},
	},
});
