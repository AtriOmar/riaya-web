import { sql } from "drizzle-orm";
import { db } from "@/db";
import { billingInvoiceCounter } from "@/db/schema";

/** Generate sequential invoice number: INV-YYYY-NNN */
export async function nextBillingInvoiceNumber(): Promise<string> {
	const year = new Date().getFullYear();

	// One atomic upsert, so concurrent callers each get a distinct sequence.
	const [row] = await db
		.insert(billingInvoiceCounter)
		.values({ year, lastSeq: 1 })
		.onConflictDoUpdate({
			target: billingInvoiceCounter.year,
			set: { lastSeq: sql`${billingInvoiceCounter.lastSeq} + 1` },
		})
		.returning({ lastSeq: billingInvoiceCounter.lastSeq });

	return `INV-${year}-${String(row.lastSeq).padStart(3, "0")}`;
}

/** Konnect orderId for first-time upgrades (no invoice yet). */
export function upgradeOrderId(subscriptionId: number): string {
	return `upgrade:${subscriptionId}`;
}

export function parseUpgradeOrderId(
	orderId: string | undefined | null,
): number | null {
	if (!orderId?.startsWith("upgrade:")) return null;
	const id = Number(orderId.slice("upgrade:".length));
	return Number.isInteger(id) && id > 0 ? id : null;
}
