import { and, eq, gt, isNull, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { blockedPhone } from "@/db/schema";
import { toPersonPhone } from "@/lib/person";

/** A block counts while it has no expiry or the expiry is still ahead. */
export const activeBlock = or(
	isNull(blockedPhone.expiresAt),
	gt(blockedPhone.expiresAt, sql`now()`),
);

export async function isPhoneBlocked(phone: string): Promise<boolean> {
	const phoneNumber = toPersonPhone(phone);
	if (!phoneNumber) return false;
	const [row] = await db
		.select({ phoneNumber: blockedPhone.phoneNumber })
		.from(blockedPhone)
		.where(and(eq(blockedPhone.phoneNumber, phoneNumber), activeBlock));
	return Boolean(row);
}

/**
 * Called for every inbound call: when the number is blocked, counts the
 * rejected attempt and returns true. One query does both.
 */
export async function recordCallIfBlocked(phone: string): Promise<boolean> {
	const phoneNumber = toPersonPhone(phone);
	if (!phoneNumber) return false;
	const rows = await db
		.update(blockedPhone)
		.set({
			rejectedCallCount: sql`${blockedPhone.rejectedCallCount} + 1`,
			lastRejectedAt: new Date(),
		})
		.where(and(eq(blockedPhone.phoneNumber, phoneNumber), activeBlock))
		.returning({ phoneNumber: blockedPhone.phoneNumber });
	return rows.length > 0;
}

/** How long an admin blocks a number for. */
export const blockDurations = ["7d", "30d", "permanent"] as const;
export const blockDurationSchema = z.enum(blockDurations);
export type BlockDuration = (typeof blockDurations)[number];

const BLOCK_DAYS: Record<BlockDuration, number | null> = {
	"7d": 7,
	"30d": 30,
	permanent: null,
};

/** When a block picked now ends; `null` = never. */
export function blockExpiry(duration: BlockDuration): Date | null {
	const days = BLOCK_DAYS[duration];
	return days === null ? null : new Date(Date.now() + days * 86_400_000);
}
