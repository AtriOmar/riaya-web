import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { call } from "@/db/schema";
import { apiError, json, requireAdmin, validationError } from "@/lib/api-utils";

// ─── POST /api/test-call/recording ───────────────────────────────────────────
// Admin-only: saves the browser-side recording of a test call (uploaded to R2
// by the client) on the simulated call's row. Real Twilio calls are recorded
// through /api/calls/recording-webhook instead.

const RECORDING_FOLDER = "test-call-recordings";

const bodySchema = z.object({
	callSid: z.string().startsWith("CA_SIM"),
	recordingUrl: z.url().max(1024),
});

export async function POST(req: NextRequest) {
	try {
		await requireAdmin();

		const parsed = bodySchema.safeParse(await req.json());
		if (!parsed.success) return validationError(parsed.error.issues);
		const { callSid, recordingUrl } = parsed.data;

		// Only accept files that came from our own upload folder.
		const cdnUrl = process.env.CDN_URL?.trim();
		if (cdnUrl && !recordingUrl.startsWith(`${cdnUrl}/${RECORDING_FOLDER}/`)) {
			return validationError([
				{ path: ["recordingUrl"], message: "Unexpected recording location" },
			]);
		}

		const [updated] = await db
			.update(call)
			.set({ recordingUrl, updatedAt: new Date() })
			.where(eq(call.callSid, callSid))
			.returning();

		if (!updated) return apiError("CALL_NOT_FOUND");

		return json(updated);
	} catch (e) {
		if (e instanceof Response) return e;
		return apiError("INTERNAL_ERROR");
	}
}

import { selectCallSchema } from "@/db/zod";
import { registry } from "@/lib/openapi";

registry.registerPath({
	method: "post",
	path: "/api/test-call/recording",
	tags: ["TestCall"],
	summary: "Save the recording of a test call (Admin)",
	request: {
		body: { content: { "application/json": { schema: bodySchema } } },
	},
	responses: {
		200: {
			description: "Updated call",
			content: { "application/json": { schema: selectCallSchema } },
		},
	},
});
