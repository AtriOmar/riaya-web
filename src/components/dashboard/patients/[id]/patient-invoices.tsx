"use client";

import { Inbox, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import ConfirmationDialog from "@/components/confirmation-dialog";
import { InvoiceFormDialog } from "@/components/dashboard/invoices/invoice-form-dialog";
import { InvoicePaymentDialog } from "@/components/dashboard/invoices/invoice-payment-dialog";
import {
	InvoiceStatusBadge,
	PAYMENT_METHOD_LABELS,
} from "@/components/dashboard/invoices/invoice-status";
import DataTable, { type Column } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { getErrorMessage } from "@/lib/error-handling";
import type { PaymentMethod } from "@/lib/invoice";
import { formatTnd } from "@/lib/money";
import type { GetApiPatientsId200InvoicesItem } from "@/services/generated/api.schemas";
import { useDeleteApiInvoicesId } from "@/services/generated/invoices/invoices";

type PatientInvoicesProps = {
	patientId: number;
	invoices: GetApiPatientsId200InvoicesItem[];
	onChanged: () => void;
};

export function PatientInvoices({
	patientId,
	invoices,
	onChanged,
}: PatientInvoicesProps) {
	const [createOpen, setCreateOpen] = useState(false);
	const [editing, setEditing] =
		useState<GetApiPatientsId200InvoicesItem | null>(null);
	const [paying, setPaying] = useState<GetApiPatientsId200InvoicesItem | null>(
		null,
	);
	const [cancelling, setCancelling] =
		useState<GetApiPatientsId200InvoicesItem | null>(null);

	const { trigger: cancelInvoice, isMutating: isCancelling } =
		useDeleteApiInvoicesId(cancelling?.id?.toString() ?? "0");

	const onConfirmCancel = async () => {
		if (!cancelling) return;
		try {
			await cancelInvoice();
			toast.success("Invoice cancelled");
			setCancelling(null);
			onChanged();
		} catch (error) {
			toast.error(getErrorMessage(error, "Failed to cancel invoice"));
		}
	};

	const columns: Column<GetApiPatientsId200InvoicesItem>[] = [
		{
			key: "number",
			header: "Number",
			cell: (row) => row.number,
		},
		{
			key: "issuedAt",
			header: "Date",
			cell: (row) =>
				row.issuedAt ? new Date(row.issuedAt).toLocaleDateString("en-GB") : "—",
		},
		{
			key: "total",
			header: "Total",
			cell: (row) => formatTnd(row.totalCentimes, row.currency),
		},
		{
			key: "paid",
			header: "Paid",
			cell: (row) => formatTnd(row.amountPaidCentimes, row.currency),
		},
		{
			key: "method",
			header: "Method",
			cell: (row) =>
				row.paymentMethod
					? PAYMENT_METHOD_LABELS[row.paymentMethod as PaymentMethod]
					: "—",
		},
		{
			key: "status",
			header: "Status",
			cell: (row) => <InvoiceStatusBadge status={row.status} />,
		},
		{
			key: "actions",
			header: "",
			cell: (row) =>
				row.status !== "cancelled" ? (
					<div className="flex flex-wrap justify-end gap-1">
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={(e) => {
								e.stopPropagation();
								setPaying(row);
							}}
						>
							Payment
						</Button>
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={(e) => {
								e.stopPropagation();
								setEditing(row);
							}}
						>
							Edit
						</Button>
						<Button
							type="button"
							variant="ghost"
							size="sm"
							className="text-destructive"
							onClick={(e) => {
								e.stopPropagation();
								setCancelling(row);
							}}
						>
							Cancel
						</Button>
					</div>
				) : null,
		},
	];

	return (
		<section className="space-y-3">
			<div className="flex items-center justify-between gap-2">
				<h4 className="font-semibold text-lg">Invoices</h4>
				<Button size="sm" onClick={() => setCreateOpen(true)}>
					<Plus className="size-4" />
					New invoice
				</Button>
			</div>

			<DataTable
				columns={columns}
				data={invoices}
				keyExtractor={(row) => row.id}
				emptyMessage={
					<div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
						<Inbox className="mb-4 w-12 h-12 opacity-50" />
						<span className="font-semibold text-foreground">
							No invoices yet
						</span>
						<span className="mt-1 text-sm">
							Create an invoice for this patient
						</span>
					</div>
				}
			/>

			<InvoiceFormDialog
				open={createOpen}
				onOpenChange={setCreateOpen}
				patientId={patientId}
				onSaved={onChanged}
			/>
			<InvoiceFormDialog
				open={!!editing}
				onOpenChange={(open) => !open && setEditing(null)}
				patientId={patientId}
				invoice={editing}
				onSaved={onChanged}
			/>
			<InvoicePaymentDialog
				open={!!paying}
				onOpenChange={(open) => !open && setPaying(null)}
				invoice={paying}
				onSaved={onChanged}
			/>
			<ConfirmationDialog
				open={!!cancelling}
				onOpenChange={(open) => !open && setCancelling(null)}
				title="Cancel invoice?"
				description={`Cancel ${cancelling?.number ?? "this invoice"}? This cannot be undone.`}
				confirmText="Cancel invoice"
				variant="destructive"
				isLoading={isCancelling}
				onConfirm={onConfirmCancel}
			/>
		</section>
	);
}
