import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";
import {
	apiError,
	json,
	requireSession,
	validationError,
} from "@/lib/api-utils";
import { generateSignedUploadUrl } from "@/lib/r2";

// ─── POST /api/upload/signed-url ─────────────────────────────────────────────
// Returns a presigned URL for the frontend to upload directly to R2

const schema = z.object({
	filename: z.string().min(1),
	contentType: z.string().min(1),
	folder: z.enum(["profile-pictures", "doctor-applications", "medical-files"]),
});

export async function POST(req: NextRequest) {
	try {
		await requireSession();

		const body = await req.json();
		const parsed = schema.safeParse(body);

		if (!parsed.success) return validationError(parsed.error.issues);

		const ext = parsed.data.filename.split(".").pop() ?? "bin";
		const key = `${parsed.data.folder}/${randomUUID()}.${ext}`;
		const signedUrl = await generateSignedUploadUrl(
			key,
			parsed.data.contentType,
		);
		const cdnUrl = `${process.env.CDN_URL}/${key}`;

		return json({ signedUrl, key, cdnUrl });
	} catch (e) {
		if (e instanceof Response) return e;
		return apiError("INTERNAL_ERROR");
	}
}

import { signedUrlResponseSchema } from "@/db/zod";
import { registry } from "@/lib/openapi";

registry.registerPath({
	method: "post",
	path: "/api/upload/signed-url",
	tags: ["Miscellaneous"],
	summary: "Generate R2 signed upload URL",
	request: {
		body: { content: { "application/json": { schema } } },
	},
	responses: {
		200: {
			description: "Signed URL details",
			content: { "application/json": { schema: signedUrlResponseSchema } },
		},
	},
});
