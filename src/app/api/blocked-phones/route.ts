import { and, desc, eq, or } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { user } from "@/db/auth-schema";
import { blockedPhone, callReport } from "@/db/schema";
import {
	selectBlockedPhoneListItemSchema,
	selectBlockedPhoneSchema,
} from "@/db/zod";
import { apiError, json, requireAdmin, validationError } from "@/lib/api-utils";
import {
	activeBlock,
	blockDurationSchema,
	blockExpiry,
} from "@/lib/blocked-phone";
import { registry } from "@/lib/openapi";
import { toPersonPhone } from "@/lib/person";

// ─── GET /api/blocked-phones ─────────────────────────────────────────────────
// Admin-only: numbers blocked right now (expired blocks are left out).

export async function GET() {
	try {
		await requireAdmin();
		const rows = await db
			.select({
				phone: blockedPhone,
				blockedByName: user.name,
			})
			.from(blockedPhone)
			.leftJoin(user, eq(user.id, blockedPhone.blockedBy))
			.where(activeBlock)
			.orderBy(desc(blockedPhone.createdAt));

		return json(
			rows.map((r) => ({ ...r.phone, blockedByName: r.blockedByName })),
		);
	} catch (e) {
		if (e instanceof Response) return e;
		return apiError("INTERNAL_ERROR");
	}
}

// ─── POST /api/blocked-phones ────────────────────────────────────────────────
// Admin-only: block a number, from a report or by hand. Every open report for
// that number is closed as `blocked`.

const createSchema = z.object({
	phoneNumber: z.string().min(1),
	reason: z.string().trim().max(1000).nullish(),
	duration: blockDurationSchema,
	reportId: z.number().int().positive().nullish(),
});

export async function POST(req: NextRequest) {
	try {
		const session = await requireAdmin();
		const parsed = createSchema.safeParse(await req.json());
		if (!parsed.success) return validationError(parsed.error.issues);

		const phoneNumber = toPersonPhone(parsed.data.phoneNumber);
		if (!phoneNumber) {
			return validationError([
				{ path: ["phoneNumber"], message: "Invalid phone number" },
			]);
		}

		const created = await db.transaction(async (tx) => {
			const [existing] = await tx
				.select({ phoneNumber: blockedPhone.phoneNumber })
				.from(blockedPhone)
				.where(and(eq(blockedPhone.phoneNumber, phoneNumber), activeBlock));
			if (existing) return null;

			const values = {
				reason: parsed.data.reason || null,
				reportId: parsed.data.reportId ?? null,
				blockedBy: session.user.id,
				expiresAt: blockExpiry(parsed.data.duration),
				rejectedCallCount: 0,
				lastRejectedAt: null,
				createdAt: new Date(),
			};
			// An expired block for the same number is replaced.
			const [row] = await tx
				.insert(blockedPhone)
				.values({ phoneNumber, ...values })
				.onConflictDoUpdate({ target: blockedPhone.phoneNumber, set: values })
				.returning();

			const isOpen = eq(callReport.status, "open");
			await tx
				.update(callReport)
				.set({
					status: "blocked",
					reviewedBy: session.user.id,
					reviewedAt: new Date(),
				})
				.where(
					and(
						eq(callReport.phoneNumber, phoneNumber),
						parsed.data.reportId
							? or(isOpen, eq(callReport.id, parsed.data.reportId))
							: isOpen,
					),
				);
			return row;
		});

		if (!created) return apiError("PHONE_ALREADY_BLOCKED");
		return json(created, 201);
	} catch (e) {
		if (e instanceof Response) return e;
		return apiError("INTERNAL_ERROR");
	}
}

registry.registerPath({
	method: "get",
	path: "/api/blocked-phones",
	tags: ["Abuse"],
	summary: "List blocked numbers (Admin)",
	responses: {
		200: {
			description: "Numbers blocked right now",
			content: {
				"application/json": {
					schema: z.array(selectBlockedPhoneListItemSchema),
				},
			},
		},
	},
});

registry.registerPath({
	method: "post",
	path: "/api/blocked-phones",
	tags: ["Abuse"],
	summary: "Block a number (Admin)",
	request: {
		body: { content: { "application/json": { schema: createSchema } } },
	},
	responses: {
		201: {
			description: "Blocked number",
			content: { "application/json": { schema: selectBlockedPhoneSchema } },
		},
	},
});
