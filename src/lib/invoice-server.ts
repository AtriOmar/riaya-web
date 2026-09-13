import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { invoice, invoicePayment } from "@/db/schema";
import { deriveInvoiceStatus } from "@/lib/invoice";

/** Generates the next invoice number for a doctor: INV-YYYY-NNNN */
export async function nextInvoiceNumber(doctorId: number): Promise<string> {
	const year = new Date().getFullYear();
	const prefix = `INV-${year}-`;

	const [row] = await db
		.select({ count: sql<number>`count(*)::int` })
		.from(invoice)
		.where(
			and(
				eq(invoice.doctorId, doctorId),
				sql`${invoice.number} like ${`${prefix}%`}`,
			),
		);

	const seq = (row?.count ?? 0) + 1;
	return `${prefix}${String(seq).padStart(4, "0")}`;
}

type TxLike = {
	select: typeof db.select;
	update: typeof db.update;
};

/** Recalculate denormalized paid amount / status / method from payment rows. */
export async function syncInvoiceFromPayments(
	tx: TxLike,
	invoiceId: number,
	totalCentimes: number,
	preserveCancelled: boolean,
) {
	const payments = await tx
		.select()
		.from(invoicePayment)
		.where(eq(invoicePayment.invoiceId, invoiceId))
		.orderBy(asc(invoicePayment.paidAt), asc(invoicePayment.id));

	const amountPaidCentimes = Math.min(
		payments.reduce((sum, p) => sum + p.amountCentimes, 0),
		totalCentimes,
	);
	const latest =
		payments.length > 0
			? [...payments].sort(
					(a, b) =>
						new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime() ||
						b.id - a.id,
				)[0]
			: null;

	const status = preserveCancelled
		? "cancelled"
		: deriveInvoiceStatus(totalCentimes, amountPaidCentimes);

	const [row] = await tx
		.update(invoice)
		.set({
			amountPaidCentimes,
			paymentMethod: latest?.paymentMethod ?? null,
			status,
			paidAt: status === "paid" ? (latest?.paidAt ?? new Date()) : null,
			updatedAt: new Date(),
		})
		.where(eq(invoice.id, invoiceId))
		.returning();

	return { invoice: row, payments };
}
