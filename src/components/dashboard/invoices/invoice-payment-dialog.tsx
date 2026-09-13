"use client";

import { Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { PAYMENT_METHOD_LABELS } from "@/components/dashboard/invoices/invoice-status";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { getErrorMessage } from "@/lib/error-handling";
import { PAYMENT_METHODS, type PaymentMethod } from "@/lib/invoice";
import { formatTnd, tndToMillimes } from "@/lib/money";
import type {
	GetApiPatientsId200InvoicesItem,
	GetApiPatientsId200InvoicesItemPaymentsItem,
	PostApiInvoicesIdPaymentsBodyPaymentMethod,
} from "@/services/generated/api.schemas";
import {
	deleteApiInvoicesIdPayments,
	usePostApiInvoicesIdPayments,
} from "@/services/generated/invoices/invoices";

type PaymentDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	invoice: GetApiPatientsId200InvoicesItem | null;
	onSaved: () => void;
};

export function InvoicePaymentDialog({
	open,
	onOpenChange,
	invoice,
	onSaved,
}: PaymentDialogProps) {
	const [amountTnd, setAmountTnd] = useState("");
	const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
	const [payments, setPayments] = useState<
		GetApiPatientsId200InvoicesItemPaymentsItem[]
	>([]);
	const [isDeleting, setIsDeleting] = useState(false);

	const invoiceId = invoice?.id?.toString() ?? "0";
	const { trigger: addPayment, isMutating: isAdding } =
		usePostApiInvoicesIdPayments(invoiceId);

	useEffect(() => {
		if (!open || !invoice) return;
		const list = invoice.payments ?? [];
		setPayments(list);
		const paid = list.reduce((sum, p) => sum + p.amountCentimes, 0);
		const remaining = Math.max(0, invoice.totalCentimes - paid);
		setAmountTnd(remaining > 0 ? String(remaining / 1000) : "");
		setPaymentMethod("cash");
	}, [open, invoice]);

	const remainingCentimes = useMemo(() => {
		if (!invoice) return 0;
		const paid = payments.reduce((sum, p) => sum + p.amountCentimes, 0);
		return Math.max(0, invoice.totalCentimes - paid);
	}, [invoice, payments]);

	if (!invoice) return null;

	const onAdd = async () => {
		const amount = Number(amountTnd.replace(",", "."));
		if (!Number.isFinite(amount) || amount <= 0) {
			toast.error("Enter a valid payment amount");
			return;
		}
		const amountCentimes = tndToMillimes(amount);
		if (amountCentimes > remainingCentimes) {
			toast.error("Amount exceeds the remaining balance");
			return;
		}

		try {
			const updated = await addPayment({
				amountCentimes,
				paymentMethod:
					paymentMethod as PostApiInvoicesIdPaymentsBodyPaymentMethod,
			});
			setPayments(updated.payments ?? []);
			const nextRemaining = Math.max(
				0,
				updated.totalCentimes - updated.amountPaidCentimes,
			);
			setAmountTnd(nextRemaining > 0 ? String(nextRemaining / 1000) : "");
			toast.success("Payment added");
			onSaved();
		} catch (error) {
			toast.error(getErrorMessage(error, "Failed to add payment"));
		}
	};

	const onRemove = async (paymentId: number) => {
		try {
			setIsDeleting(true);
			const updated = await deleteApiInvoicesIdPayments(invoiceId, {
				paymentId,
			});
			setPayments(updated.payments ?? []);
			const nextRemaining = Math.max(
				0,
				updated.totalCentimes - updated.amountPaidCentimes,
			);
			setAmountTnd(nextRemaining > 0 ? String(nextRemaining / 1000) : "");
			toast.success("Payment removed");
			onSaved();
		} catch (error) {
			toast.error(getErrorMessage(error, "Failed to remove payment"));
		} finally {
			setIsDeleting(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-md max-h-[90vh] overflow-y-auto sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Payments — {invoice.number}</DialogTitle>
				</DialogHeader>

				<div className="space-y-4">
					<div className="flex justify-between gap-4 text-sm">
						<span className="text-muted-foreground">
							Total{" "}
							<span className="font-medium text-foreground">
								{formatTnd(invoice.totalCentimes, invoice.currency)}
							</span>
						</span>
						<span className="text-muted-foreground">
							Remaining{" "}
							<span className="font-medium text-foreground">
								{formatTnd(remainingCentimes, invoice.currency)}
							</span>
						</span>
					</div>

					{payments.length === 0 ? (
						<p className="rounded-lg border border-dashed py-6 text-center text-muted-foreground text-sm">
							No payments yet
						</p>
					) : (
						<ul className="divide-y rounded-lg border">
							{payments.map((payment) => (
								<li
									key={payment.id}
									className="flex items-center justify-between gap-3 px-3 py-2.5"
								>
									<div className="min-w-0">
										<p className="font-medium text-sm">
											{formatTnd(payment.amountCentimes, invoice.currency)}
										</p>
										<p className="text-muted-foreground text-xs">
											{
												PAYMENT_METHOD_LABELS[
													payment.paymentMethod as PaymentMethod
												]
											}
											{" · "}
											{new Date(payment.paidAt).toLocaleString("en-GB", {
												dateStyle: "short",
												timeStyle: "short",
											})}
										</p>
									</div>
									<Button
										type="button"
										variant="ghost"
										size="icon"
										className="shrink-0"
										disabled={isDeleting}
										onClick={() => onRemove(payment.id)}
										aria-label="Remove payment"
									>
										<Trash2 className="size-4 text-muted-foreground" />
									</Button>
								</li>
							))}
						</ul>
					)}

					{remainingCentimes > 0 && (
						<div className="space-y-3 rounded-lg border p-3">
							<p className="font-medium text-sm">Add payment</p>
							<div className="gap-3 grid sm:grid-cols-2">
								<div className="space-y-1">
									<Label htmlFor="pay-amount">Amount (TND)</Label>
									<Input
										id="pay-amount"
										inputMode="decimal"
										value={amountTnd}
										onChange={(e) => setAmountTnd(e.target.value)}
									/>
								</div>
								<div className="space-y-1">
									<Label>Method</Label>
									<Select
										value={paymentMethod}
										onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}
									>
										<SelectTrigger className="w-full">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											{PAYMENT_METHODS.map((method) => (
												<SelectItem key={method} value={method}>
													{PAYMENT_METHOD_LABELS[method]}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
							</div>
							<Button
								type="button"
								className="w-full"
								onClick={onAdd}
								disabled={isAdding}
							>
								<Plus className="size-4" />
								{isAdding ? "Adding…" : "Add payment"}
							</Button>
						</div>
					)}
				</div>

				<DialogFooter>
					<Button variant="outline" onClick={() => onOpenChange(false)}>
						Close
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
