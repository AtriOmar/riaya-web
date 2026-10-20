import { and, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { blockedPhone } from "@/db/schema";
import { selectBlockedPhoneSchema } from "@/db/zod";
import { apiError, json, requireAdmin, validationError } from "@/lib/api-utils";
import {
	activeBlock,
	blockDurationSchema,
	blockExpiry,
} from "@/lib/blocked-phone";
import { registry } from "@/lib/openapi";
import { toPersonPhone } from "@/lib/person";

const paramsSchema = z.object({ phone: z.string() });

async function phoneFromParams(params: Promise<{ phone: string }>) {
	const { phone } = await params;
	return toPersonPhone(decodeURIComponent(phone));
}

// ─── PATCH /api/blocked-phones/[phone] ───────────────────────────────────────
// Admin-only: change how long the block lasts, counted from now.

const patchSchema = z.object({
	duration: blockDurationSchema,
});

export async function PATCH(
	req: NextRequest,
	{ params }: { params: Promise<{ phone: string }> },
) {
	try {
		await requireAdmin();
		const phoneNumber = await phoneFromParams(params);
		if (!phoneNumber) return apiError("BLOCKED_PHONE_NOT_FOUND");

		const parsed = patchSchema.safeParse(await req.json());
		if (!parsed.success) return validationError(parsed.error.issues);

		const [updated] = await db
			.update(blockedPhone)
			.set({ expiresAt: blockExpiry(parsed.data.duration) })
			.where(and(eq(blockedPhone.phoneNumber, phoneNumber), activeBlock))
			.returning();
		if (!updated) return apiError("BLOCKED_PHONE_NOT_FOUND");

		return json(updated);
	} catch (e) {
		if (e instanceof Response) return e;
		return apiError("INTERNAL_ERROR");
	}
}

// ─── DELETE /api/blocked-phones/[phone] ──────────────────────────────────────
// Admin-only: unblock. The reports stay as history.

export async function DELETE(
	_req: NextRequest,
	{ params }: { params: Promise<{ phone: string }> },
) {
	try {
		await requireAdmin();
		const phoneNumber = await phoneFromParams(params);
		if (!phoneNumber) return apiError("BLOCKED_PHONE_NOT_FOUND");

		const [deleted] = await db
			.delete(blockedPhone)
			.where(eq(blockedPhone.phoneNumber, phoneNumber))
			.returning();
		if (!deleted) return apiError("BLOCKED_PHONE_NOT_FOUND");

		return json(deleted);
	} catch (e) {
		if (e instanceof Response) return e;
		return apiError("INTERNAL_ERROR");
	}
}

registry.registerPath({
	method: "patch",
	path: "/api/blocked-phones/{phone}",
	tags: ["Abuse"],
	summary: "Change how long a number stays blocked (Admin)",
	request: {
		params: paramsSchema,
		body: { content: { "application/json": { schema: patchSchema } } },
	},
	responses: {
		200: {
			description: "Updated block",
			content: { "application/json": { schema: selectBlockedPhoneSchema } },
		},
	},
});

registry.registerPath({
	method: "delete",
	path: "/api/blocked-phones/{phone}",
	tags: ["Abuse"],
	summary: "Unblock a number (Admin)",
	request: { params: paramsSchema },
	responses: {
		200: {
			description: "The removed block",
			content: { "application/json": { schema: selectBlockedPhoneSchema } },
		},
	},
});
