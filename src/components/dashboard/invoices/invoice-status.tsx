import type { VariantProps } from "class-variance-authority";
import { Badge } from "@/components/ui/badge";
import {
	formatInvoiceStatus,
	INVOICE_STATUS_LABELS,
	type InvoiceStatus,
	PAYMENT_METHOD_LABELS,
} from "@/lib/invoice";

export { formatInvoiceStatus, INVOICE_STATUS_LABELS, PAYMENT_METHOD_LABELS };

type BadgeVariant = NonNullable<VariantProps<typeof Badge>["variant"]>;

export const INVOICE_STATUS_BADGE: Record<InvoiceStatus, BadgeVariant> = {
	unpaid: "warning",
	partially_paid: "secondary",
	paid: "success",
	cancelled: "outline",
};

export function InvoiceStatusBadge({ status }: { status: string }) {
	const variant =
		INVOICE_STATUS_BADGE[status as InvoiceStatus] ?? ("outline" as const);
	return <Badge variant={variant}>{formatInvoiceStatus(status)}</Badge>;
}
