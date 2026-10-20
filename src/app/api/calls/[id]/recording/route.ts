import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { call } from "@/db/schema";
import { apiError, requireAdmin } from "@/lib/api-utils";

// ─── GET /api/calls/[id]/recording ───────────────────────────────────────────
// Admin-only. Same-origin passthrough of the call's recording bytes so the
// browser can decode it for the waveform (the CDN sends no CORS headers).
// Playback itself keeps using the CDN URL directly.

export async function GET(
	_req: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	try {
		await requireAdmin();

		const { id } = await params;
		const callId = Number(id);
		if (Number.isNaN(callId)) return apiError("INVALID_ID");

		const [row] = await db
			.select({ recordingUrl: call.recordingUrl })
			.from(call)
			.where(eq(call.id, callId));
		if (!row?.recordingUrl) return apiError("CALL_NOT_FOUND");

		const upstream = await fetch(row.recordingUrl);
		if (!upstream.ok || !upstream.body) return apiError("INTERNAL_ERROR");

		return new Response(upstream.body, {
			headers: {
				"Content-Type":
					upstream.headers.get("content-type") ?? "application/octet-stream",
				"Cache-Control": "private, max-age=3600",
			},
		});
	} catch (e) {
		if (e instanceof Response) return e;
		return apiError("INTERNAL_ERROR");
	}
}

import { registry } from "@/lib/openapi";

registry.registerPath({
	method: "get",
	path: "/api/calls/{id}/recording",
	tags: ["Calls"],
	summary: "Stream a call recording (Admin)",
	request: { params: z.object({ id: z.string() }) },
	responses: {
		200: {
			description: "Recording audio bytes",
			content: {
				"application/octet-stream": {
					schema: z.string().openapi({ format: "binary" }),
				},
			},
		},
	},
});
