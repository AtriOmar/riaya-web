export const INVOICE_STATUSES = [
	"unpaid",
	"partially_paid",
	"paid",
	"cancelled",
] as const;

export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const PAYMENT_METHODS = ["cash", "transfer"] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export function deriveInvoiceStatus(
	totalCentimes: number,
	amountPaidCentimes: number,
	currentStatus?: string | null,
): InvoiceStatus {
	if (currentStatus === "cancelled") return "cancelled";
	if (amountPaidCentimes <= 0) return "unpaid";
	if (amountPaidCentimes >= totalCentimes && totalCentimes > 0) return "paid";
	if (amountPaidCentimes > 0 && amountPaidCentimes < totalCentimes) {
		return "partially_paid";
	}
	// total is 0 and nothing paid — treat as unpaid
	return "unpaid";
}

export function sumItemsCentimes(
	items: { quantity: number; unitPriceCentimes: number }[],
): number {
	return items.reduce(
		(sum, item) => sum + item.quantity * item.unitPriceCentimes,
		0,
	);
}
