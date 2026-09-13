"use client";

import { Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
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
import { Textarea } from "@/components/ui/textarea";
import { getErrorMessage } from "@/lib/error-handling";
import { formatTnd, millimesToTnd, tndToMillimes } from "@/lib/money";
import type { GetApiPatientsId200InvoicesItem } from "@/services/generated/api.schemas";
import {
	usePatchApiInvoicesId,
	usePostApiInvoices,
} from "@/services/generated/invoices/invoices";

type LineDraft = {
	key: string;
	description: string;
	quantity: string;
	unitPriceTnd: string;
};

function newLine(description = "Consultation"): LineDraft {
	return {
		key: crypto.randomUUID(),
		description,
		quantity: "1",
		unitPriceTnd: "",
	};
}

function linesFromInvoice(
	invoice: GetApiPatientsId200InvoicesItem | null,
): LineDraft[] {
	if (!invoice?.items?.length) return [newLine()];
	return invoice.items.map((item) => ({
		key: String(item.id),
		description: item.description,
		quantity: String(item.quantity),
		unitPriceTnd: String(millimesToTnd(item.unitPriceCentimes)),
	}));
}

type InvoiceFormDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	patientId: number;
	invoice?: GetApiPatientsId200InvoicesItem | null;
	onSaved: () => void;
};

export function InvoiceFormDialog({
	open,
	onOpenChange,
	patientId,
	invoice = null,
	onSaved,
}: InvoiceFormDialogProps) {
	const isEdit = !!invoice;
	const [lines, setLines] = useState<LineDraft[]>(() =>
		linesFromInvoice(invoice),
	);
	const [notes, setNotes] = useState(invoice?.notes ?? "");

	const { trigger: createInvoice, isMutating: isCreating } =
		usePostApiInvoices();
	const { trigger: updateInvoice, isMutating: isUpdating } =
		usePatchApiInvoicesId(invoice?.id?.toString() ?? "0");

	const isSubmitting = isCreating || isUpdating;

	useEffect(() => {
		if (!open) return;
		setLines(linesFromInvoice(invoice));
		setNotes(invoice?.notes ?? "");
	}, [open, invoice]);

	const totalCentimes = useMemo(() => {
		return lines.reduce((sum, line) => {
			const qty = Number(line.quantity);
			const price = Number(line.unitPriceTnd.replace(",", "."));
			if (
				!Number.isFinite(qty) ||
				qty <= 0 ||
				!Number.isFinite(price) ||
				price < 0
			)
				return sum;
			return sum + tndToMillimes(price) * qty;
		}, 0);
	}, [lines]);

	const updateLine = (key: string, patch: Partial<LineDraft>) => {
		setLines((prev) =>
			prev.map((line) => (line.key === key ? { ...line, ...patch } : line)),
		);
	};

	const removeLine = (key: string) => {
		setLines((prev) =>
			prev.length <= 1 ? prev : prev.filter((l) => l.key !== key),
		);
	};

	const onSubmit = async () => {
		const items: {
			description: string;
			quantity: number;
			unitPriceCentimes: number;
		}[] = [];

		for (const line of lines) {
			const description = line.description.trim();
			const quantity = Number(line.quantity);
			const unitPrice = Number(line.unitPriceTnd.replace(",", "."));
			if (!description) {
				toast.error("Each line needs a description");
				return;
			}
			if (!Number.isFinite(quantity) || quantity < 1) {
				toast.error("Quantity must be at least 1");
				return;
			}
			if (!Number.isFinite(unitPrice) || unitPrice < 0) {
				toast.error("Enter a valid unit price");
				return;
			}
			items.push({
				description,
				quantity: Math.floor(quantity),
				unitPriceCentimes: tndToMillimes(unitPrice),
			});
		}

		try {
			if (isEdit && invoice) {
				await updateInvoice({
					notes: notes.trim() || null,
					items,
				});
				toast.success("Invoice updated");
			} else {
				await createInvoice({
					patientId,
					notes: notes.trim() || undefined,
					items,
				});
				toast.success("Invoice created");
			}
			onOpenChange(false);
			onSaved();
		} catch (error) {
			toast.error(getErrorMessage(error, "Failed to save invoice"));
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>{isEdit ? "Edit invoice" : "New invoice"}</DialogTitle>
				</DialogHeader>

				<div className="space-y-4">
					<div className="space-y-2">
						<div className="flex items-center justify-between">
							<Label>Line items</Label>
							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={() => setLines((prev) => [...prev, newLine("")])}
							>
								<Plus className="size-4" />
								Add line
							</Button>
						</div>
						<div className="space-y-3">
							{lines.map((line) => (
								<div
									key={line.key}
									className="gap-2 grid grid-cols-[1fr_4.5rem_6rem_auto] items-end"
								>
									<div className="space-y-1">
										<Label className="text-xs text-muted-foreground">
											Description
										</Label>
										<Input
											value={line.description}
											onChange={(e) =>
												updateLine(line.key, { description: e.target.value })
											}
											placeholder="Consultation"
										/>
									</div>
									<div className="space-y-1">
										<Label className="text-xs text-muted-foreground">Qty</Label>
										<Input
											type="number"
											min={1}
											value={line.quantity}
											onChange={(e) =>
												updateLine(line.key, { quantity: e.target.value })
											}
										/>
									</div>
									<div className="space-y-1">
										<Label className="text-xs text-muted-foreground">
											Price (TND)
										</Label>
										<Input
											inputMode="decimal"
											value={line.unitPriceTnd}
											onChange={(e) =>
												updateLine(line.key, { unitPriceTnd: e.target.value })
											}
											placeholder="150"
										/>
									</div>
									<Button
										type="button"
										variant="ghost"
										size="icon"
										className="shrink-0"
										disabled={lines.length <= 1}
										onClick={() => removeLine(line.key)}
										aria-label="Remove line"
									>
										<Trash2 className="size-4 text-muted-foreground" />
									</Button>
								</div>
							))}
						</div>
						<p className="font-medium text-sm text-right">
							Total: {formatTnd(totalCentimes)}
						</p>
					</div>

					<div className="space-y-1">
						<Label htmlFor="invoice-notes">Notes</Label>
						<Textarea
							id="invoice-notes"
							value={notes}
							onChange={(e) => setNotes(e.target.value)}
							placeholder="Optional notes"
							rows={2}
						/>
					</div>
				</div>

				<DialogFooter>
					<Button variant="outline" onClick={() => onOpenChange(false)}>
						Cancel
					</Button>
					<Button onClick={onSubmit} disabled={isSubmitting}>
						{isSubmitting ? "Saving…" : isEdit ? "Save changes" : "Create"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
