"use client";

import { Inbox } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { InvoicePaymentDialog } from "@/components/dashboard/invoices/invoice-payment-dialog";
import {
	InvoiceStatusBadge,
	PAYMENT_METHOD_LABELS,
} from "@/components/dashboard/invoices/invoice-status";
import DataTable, { type Column } from "@/components/data-table";
import { CubeLoader } from "@/components/loaders";
import { Button } from "@/components/ui/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import type { InvoiceStatus, PaymentMethod } from "@/lib/invoice";
import { INVOICE_STATUSES } from "@/lib/invoice";
import { formatTnd } from "@/lib/money";
import type {
	GetApiInvoices200Item,
	GetApiPatientsId200InvoicesItem,
} from "@/services/generated/api.schemas";
import { useGetApiInvoices } from "@/services/generated/invoices/invoices";
import { INVOICE_STATUS_LABELS } from "./invoice-status";

function patientName(row: GetApiInvoices200Item): string {
	const first = row.patient?.firstName ?? "";
	const last = row.patient?.lastName ?? "";
	const name = `${first} ${last}`.trim();
	return name || "—";
}

export default function InvoicesList() {
	const [statusFilter, setStatusFilter] = useState<string>("all");
	const [paying, setPaying] = useState<GetApiInvoices200Item | null>(null);

	const params = useMemo(
		() =>
			statusFilter === "all"
				? undefined
				: { status: statusFilter as InvoiceStatus },
		[statusFilter],
	);

	const { data: invoices, isLoading, mutate } = useGetApiInvoices(params);

	const columns: Column<GetApiInvoices200Item>[] = [
		{
			key: "number",
			header: "Number",
			cell: (row) => row.number,
		},
		{
			key: "patient",
			header: "Patient",
			cell: (row) =>
				row.patientId ? (
					<Link
						href={`/dashboard/patients/${row.patientId}`}
						className="text-primary hover:underline"
						onClick={(e) => e.stopPropagation()}
					>
						{patientName(row)}
					</Link>
				) : (
					patientName(row)
				),
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
				) : null,
		},
	];

	if (isLoading && !invoices) {
		return (
			<div className="flex justify-center py-16">
				<CubeLoader />
			</div>
		);
	}

	return (
		<div className="space-y-4">
			<div className="flex justify-end">
				<Select value={statusFilter} onValueChange={setStatusFilter}>
					<SelectTrigger className="w-[180px] md:-mt-12">
						<SelectValue placeholder="Status" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">All statuses</SelectItem>
						{INVOICE_STATUSES.map((status) => (
							<SelectItem key={status} value={status}>
								{INVOICE_STATUS_LABELS[status]}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>

			<DataTable
				columns={columns}
				data={invoices ?? []}
				keyExtractor={(row) => row.id}
				isLoading={isLoading}
				emptyMessage={
					<div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
						<Inbox className="mb-4 w-12 h-12 opacity-50" />
						<span className="font-semibold text-foreground">No invoices</span>
						<span className="mt-1 text-sm">
							Create invoices from a patient page
						</span>
					</div>
				}
			/>

			<InvoicePaymentDialog
				open={!!paying}
				onOpenChange={(open) => !open && setPaying(null)}
				invoice={paying as GetApiPatientsId200InvoicesItem | null}
				onSaved={() => mutate()}
			/>
		</div>
	);
}
