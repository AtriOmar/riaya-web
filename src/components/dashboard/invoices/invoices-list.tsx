"use client";

import { Inbox, ListFilter, MessageSquare, Plus } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { InvoiceFormDialog } from "@/components/dashboard/invoices/invoice-form-dialog";
import { InvoicePaymentDialog } from "@/components/dashboard/invoices/invoice-payment-dialog";
import {
	InvoiceStatusBadge,
	PAYMENT_METHOD_LABELS,
} from "@/components/dashboard/invoices/invoice-status";
import DataTable, { type Column } from "@/components/data-table";
import { CubeLoader } from "@/components/loaders";
import { Button } from "@/components/ui/button";
import { FilterSelect } from "@/components/ui/filter-controls";
import { getErrorMessage } from "@/lib/error-handling";
import type { InvoiceStatus, PaymentMethod } from "@/lib/invoice";
import { INVOICE_STATUSES } from "@/lib/invoice";
import { formatTnd } from "@/lib/money";
import type {
	GetApiInvoices200Item,
	GetApiPatientsId200InvoicesItem,
} from "@/services/generated/api.schemas";
import {
	postApiInvoicesIdSend,
	useGetApiInvoices,
} from "@/services/generated/invoices/invoices";
import { INVOICE_STATUS_LABELS } from "./invoice-status";

const STATUS_FILTER_DOT: Record<string, string> = {
	all: "bg-muted-foreground/40",
	unpaid: "bg-yellow-500",
	partially_paid: "bg-slate-400",
	paid: "bg-green-500",
	cancelled: "bg-muted-foreground/30",
};

function patientName(row: GetApiInvoices200Item): string {
	const first = row.patient?.firstName ?? "";
	const last = row.patient?.lastName ?? "";
	const name = `${first} ${last}`.trim();
	return name || "—";
}

export default function InvoicesList() {
	const [statusFilter, setStatusFilter] = useState<string>("all");
	const [createOpen, setCreateOpen] = useState(false);
	const [paying, setPaying] = useState<GetApiInvoices200Item | null>(null);
	const [sendingId, setSendingId] = useState<number | null>(null);

	const params = useMemo(
		() =>
			statusFilter === "all"
				? undefined
				: { status: statusFilter as InvoiceStatus },
		[statusFilter],
	);

	const { data: invoices, isLoading, mutate } = useGetApiInvoices(params);

	const onSendWhatsapp = async (row: GetApiInvoices200Item) => {
		try {
			setSendingId(row.id);
			await postApiInvoicesIdSend(row.id.toString());
			toast.success("Invoice sent on WhatsApp");
			void mutate();
		} catch (error) {
			toast.error(getErrorMessage(error, "Failed to send invoice"));
		} finally {
			setSendingId(null);
		}
	};

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
					<div className="flex flex-wrap justify-end gap-1">
						<Button
							type="button"
							variant="outline"
							size="sm"
							disabled={sendingId === row.id}
							onClick={(e) => {
								e.stopPropagation();
								void onSendWhatsapp(row);
							}}
						>
							<MessageSquare className="size-4" />
							{sendingId === row.id
								? "Sending…"
								: row.sentViaWhatsapp
									? "Resend"
									: "WhatsApp"}
						</Button>
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
					</div>
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
			<div className="flex flex-wrap items-center justify-end gap-2 md:-mt-12">
				<FilterSelect
					icon={ListFilter}
					label="Filter by status"
					value={statusFilter}
					onValueChange={setStatusFilter}
					options={[
						{ value: "all", label: "All statuses", dot: STATUS_FILTER_DOT.all },
						...INVOICE_STATUSES.map((status) => ({
							value: status,
							label: INVOICE_STATUS_LABELS[status],
							dot: STATUS_FILTER_DOT[status],
						})),
					]}
				/>
				<Button onClick={() => setCreateOpen(true)}>
					<Plus className="size-4" />
					New invoice
				</Button>
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
							Create an invoice for a patient
						</span>
						<Button
							className="mt-4"
							size="sm"
							onClick={() => setCreateOpen(true)}
						>
							<Plus className="size-4" />
							New invoice
						</Button>
					</div>
				}
			/>

			<InvoiceFormDialog
				open={createOpen}
				onOpenChange={setCreateOpen}
				onSaved={() => mutate()}
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
