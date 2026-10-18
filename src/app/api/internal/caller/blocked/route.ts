import type { NextRequest } from "next/server";
import { z } from "zod";
import { json, requireInternal, validationError } from "@/lib/api-utils";
import { recordCallIfBlocked } from "@/lib/blocked-phone";
import { apiError } from "@/lib/errors";
import { registry } from "@/lib/openapi";

// ─── POST /api/internal/caller/blocked ───────────────────────────────────────
// Asked by the voice service on every incoming call, before the AI answers.
// A blocked number also gets its rejected attempt counted.

const bodySchema = z.object({
	phoneNumber: z.string().min(1),
});

const responseSchema = z.object({
	blocked: z.boolean(),
});

export async function POST(req: NextRequest) {
	try {
		requireInternal(req);
		const parsed = bodySchema.safeParse(await req.json());
		if (!parsed.success) return validationError(parsed.error.issues);

		return json({
			blocked: await recordCallIfBlocked(parsed.data.phoneNumber),
		});
	} catch (e) {
		if (e instanceof Response) return e;
		return apiError("INTERNAL_ERROR");
	}
}

registry.registerPath({
	method: "post",
	path: "/api/internal/caller/blocked",
	tags: ["Caller"],
	summary: "Is the caller's number blocked (voice service)",
	request: {
		body: { content: { "application/json": { schema: bodySchema } } },
	},
	responses: {
		200: {
			description: "Whether the AI should refuse this call",
			content: { "application/json": { schema: responseSchema } },
		},
	},
});
