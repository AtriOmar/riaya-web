"use client";

import { ExternalLink, FileText, Loader2 } from "lucide-react";
import { useState } from "react";
import useSWR from "swr";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";

type BillingInvoice = {
	id: number;
	number: string;
	status: "open" | "paid" | "cancelled";
	amountMillimes: number;
	konnectPayUrl: string | null;
	periodStart: string | null;
	periodEnd: string | null;
	createdAt: string | null;
};

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function formatAmount(millimes: number) {
	return `${(millimes / 1000).toLocaleString("fr-TN", {
		minimumFractionDigits: 3,
		maximumFractionDigits: 3,
	})} TND`;
}

function statusVariant(
	status: string,
): "default" | "secondary" | "destructive" | "outline" {
	switch (status) {
		case "paid":
			return "default";
		case "open":
			return "destructive";
		case "cancelled":
			return "secondary";
		default:
			return "outline";
	}
}

function PayButton({ invoice }: { invoice: BillingInvoice }) {
	const [loading, setLoading] = useState(false);

	async function handlePay() {
		setLoading(true);
		try {
			// Re-initiate / retrieve Konnect payment URL
			const res = await fetch(`/api/billing/invoices/${invoice.id}`, {
				method: "POST",
			});
			const data = (await res.json()) as {
				payUrl?: string;
				alreadyPaid?: boolean;
			};

			if (data.alreadyPaid) {
				window.location.reload();
				return;
			}

			if (data.payUrl) {
				window.open(data.payUrl, "_blank", "noopener,noreferrer");
			}
		} catch {
			// fail silently — user can retry
		} finally {
			setLoading(false);
		}
	}

	return (
		<Button size="sm" onClick={handlePay} disabled={loading}>
			{loading ? (
				<Loader2 className="size-4 animate-spin mr-1" />
			) : (
				<ExternalLink className="size-4 mr-1" />
			)}
			Pay
		</Button>
	);
}

export default function BillingInvoicesList() {
	const { data: invoices, isLoading } = useSWR<BillingInvoice[]>(
		"/api/billing/invoices",
		fetcher,
	);

	if (isLoading) {
		return (
			<div className="flex items-center justify-center py-12">
				<Loader2 className="size-6 animate-spin text-muted-foreground" />
			</div>
		);
	}

	if (!invoices?.length) {
		return (
			<div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed py-12 text-center">
				<FileText className="size-8 text-muted-foreground" />
				<p className="text-sm text-muted-foreground">
					No billing invoices yet. They appear when your subscription is due for
					renewal.
				</p>
			</div>
		);
	}

	return (
		<div className="rounded-xl border overflow-hidden">
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead>Invoice</TableHead>
						<TableHead>Date</TableHead>
						<TableHead>Status</TableHead>
						<TableHead>Amount</TableHead>
						<TableHead className="text-right">Actions</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{invoices.map((invoice) => (
						<TableRow key={invoice.id}>
							<TableCell className="font-medium">{invoice.number}</TableCell>
							<TableCell className="text-muted-foreground">
								{invoice.createdAt
									? new Date(invoice.createdAt).toLocaleDateString("en-GB", {
											month: "short",
											day: "numeric",
											year: "numeric",
										})
									: "—"}
							</TableCell>
							<TableCell>
								<Badge
									variant={statusVariant(invoice.status)}
									className="capitalize"
								>
									{invoice.status}
								</Badge>
							</TableCell>
							<TableCell>{formatAmount(invoice.amountMillimes)}</TableCell>
							<TableCell>
								<div className="flex justify-end gap-2">
									{invoice.status === "open" && <PayButton invoice={invoice} />}
								</div>
							</TableCell>
						</TableRow>
					))}
				</TableBody>
			</Table>
		</div>
	);
}
