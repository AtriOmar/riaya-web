import { sql } from "drizzle-orm";
import { db } from "@/db";
import { billingInvoice } from "@/db/schema";

/** Generate sequential invoice number: INV-YYYY-NNN */
export async function nextBillingInvoiceNumber(): Promise<string> {
	const year = new Date().getFullYear();
	const prefix = `INV-${year}-`;

	const [row] = await db
		.select({ count: sql<number>`count(*)` })
		.from(billingInvoice)
		.where(sql`number like ${prefix + "%"}`);

	const seq = (Number(row?.count ?? 0) + 1).toString().padStart(3, "0");
	return `${prefix}${seq}`;
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
