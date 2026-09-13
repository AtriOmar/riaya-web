import type { VariantProps } from "class-variance-authority";
import { Badge } from "@/components/ui/badge";
import type { InvoiceStatus, PaymentMethod } from "@/lib/invoice";

type BadgeVariant = NonNullable<VariantProps<typeof Badge>["variant"]>;

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
	unpaid: "Unpaid",
	partially_paid: "Partially paid",
	paid: "Paid",
	cancelled: "Cancelled",
};

export const INVOICE_STATUS_BADGE: Record<InvoiceStatus, BadgeVariant> = {
	unpaid: "warning",
	partially_paid: "secondary",
	paid: "success",
	cancelled: "outline",
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
	cash: "Cash",
	transfer: "Transfer",
};

export function formatInvoiceStatus(status: string | null | undefined): string {
	if (!status) return "—";
	return INVOICE_STATUS_LABELS[status as InvoiceStatus] ?? status;
}

export function InvoiceStatusBadge({ status }: { status: string }) {
	const variant =
		INVOICE_STATUS_BADGE[status as InvoiceStatus] ?? ("outline" as const);
	return <Badge variant={variant}>{formatInvoiceStatus(status)}</Badge>;
}
