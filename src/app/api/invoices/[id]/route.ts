import { and, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { invoice, invoiceItem } from "@/db/schema";
import {
	selectInvoiceWithItemsSchema,
	selectInvoiceWithPatientSchema,
} from "@/db/zod";
import {
	apiError,
	json,
	requireDoctorProfile,
	requireSession,
	validationError,
} from "@/lib/api-utils";
import { sumItemsCentimes } from "@/lib/invoice";
import { syncInvoiceFromPayments } from "@/lib/invoice-server";
import { registry } from "@/lib/openapi";

const paramsSchema = z.object({ id: z.string() });

const itemSchema = z.object({
	description: z.string().min(1),
	quantity: z.coerce.number().int().positive().default(1),
	unitPriceCentimes: z.coerce.number().int().nonnegative(),
});

const updateSchema = z
	.object({
		notes: z.string().nullable().optional(),
		items: z.array(itemSchema).min(1).optional(),
		/** Set to "cancelled" to cancel; omit to keep derived payment status. */
		status: z.enum(["cancelled"]).optional(),
	})
	.refine(
		(d) =>
			d.notes !== undefined || d.items !== undefined || d.status !== undefined,
		{ message: "At least one field to update is required" },
	);

async function loadDoctorInvoice(invoiceId: number, doctorId: number) {
	return db.query.invoice.findFirst({
		where: and(eq(invoice.id, invoiceId), eq(invoice.doctorId, doctorId)),
		with: {
			items: true,
			payments: {
				orderBy: (p, { asc }) => [asc(p.paidAt), asc(p.id)],
			},
			patient: {
				columns: {
					id: true,
					firstName: true,
					lastName: true,
					cin: true,
					phoneNumber: true,
				},
			},
		},
	});
}

// ─── GET /api/invoices/[id] ───────────────────────────────────────────────────

export async function GET(
	_req: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	try {
		const session = await requireSession();
		const profile = await requireDoctorProfile(session.user.id);

		const { id } = await params;
		const invoiceId = Number(id);
		if (Number.isNaN(invoiceId)) return apiError("INVALID_ID");

		const record = await loadDoctorInvoice(invoiceId, profile.id);
		if (!record) return apiError("INVOICE_NOT_FOUND");

		return json(record);
	} catch (e) {
		if (e instanceof Response) return e;
		return apiError("INTERNAL_ERROR");
	}
}

// ─── PATCH /api/invoices/[id] ─────────────────────────────────────────────────

export async function PATCH(
	req: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	try {
		const session = await requireSession();
		const profile = await requireDoctorProfile(session.user.id);

		const { id } = await params;
		const invoiceId = Number(id);
		if (Number.isNaN(invoiceId)) return apiError("INVALID_ID");

		const existing = await db.query.invoice.findFirst({
			where: and(eq(invoice.id, invoiceId), eq(invoice.doctorId, profile.id)),
			with: {
				items: true,
				payments: {
					orderBy: (p, { asc }) => [asc(p.paidAt), asc(p.id)],
				},
			},
		});
		if (!existing) return apiError("INVOICE_NOT_FOUND");

		const body = await req.json();
		const parsed = updateSchema.safeParse(body);
		if (!parsed.success) return validationError(parsed.error.issues);

		if (existing.status === "cancelled" && parsed.data.status !== "cancelled") {
			return apiError("INVOICE_CANCELLED");
		}

		const nextTotal =
			parsed.data.items != null
				? sumItemsCentimes(parsed.data.items)
				: existing.totalCentimes;

		const updated = await db.transaction(async (tx) => {
			let items = existing.items;

			if (parsed.data.items) {
				await tx
					.delete(invoiceItem)
					.where(eq(invoiceItem.invoiceId, invoiceId));
				items = await tx
					.insert(invoiceItem)
					.values(
						parsed.data.items.map((item) => ({
							invoiceId,
							description: item.description,
							quantity: item.quantity,
							unitPriceCentimes: item.unitPriceCentimes,
						})),
					)
					.returning();
			}

			if (parsed.data.notes !== undefined) {
				await tx
					.update(invoice)
					.set({
						notes: parsed.data.notes,
						totalCentimes: nextTotal,
						updatedAt: new Date(),
					})
					.where(eq(invoice.id, invoiceId));
			} else if (parsed.data.items) {
				await tx
					.update(invoice)
					.set({
						totalCentimes: nextTotal,
						updatedAt: new Date(),
					})
					.where(eq(invoice.id, invoiceId));
			}

			const synced = await syncInvoiceFromPayments(
				tx,
				invoiceId,
				nextTotal,
				parsed.data.status === "cancelled" || existing.status === "cancelled",
			);

			if (
				parsed.data.status === "cancelled" &&
				synced.invoice.status !== "cancelled"
			) {
				const [cancelled] = await tx
					.update(invoice)
					.set({ status: "cancelled", updatedAt: new Date() })
					.where(eq(invoice.id, invoiceId))
					.returning();
				return {
					...cancelled,
					items,
					payments: synced.payments,
				};
			}

			return {
				...synced.invoice,
				items,
				payments: synced.payments,
			};
		});

		return json(updated);
	} catch (e) {
		if (e instanceof Response) return e;
		return apiError("INTERNAL_ERROR");
	}
}

// ─── DELETE /api/invoices/[id] ────────────────────────────────────────────────
// Soft-cancels the invoice.

export async function DELETE(
	_req: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	try {
		const session = await requireSession();
		const profile = await requireDoctorProfile(session.user.id);

		const { id } = await params;
		const invoiceId = Number(id);
		if (Number.isNaN(invoiceId)) return apiError("INVALID_ID");

		const [updated] = await db
			.update(invoice)
			.set({
				status: "cancelled",
				updatedAt: new Date(),
			})
			.where(and(eq(invoice.id, invoiceId), eq(invoice.doctorId, profile.id)))
			.returning();

		if (!updated) return apiError("INVOICE_NOT_FOUND");

		const record = await loadDoctorInvoice(invoiceId, profile.id);
		return json(record);
	} catch (e) {
		if (e instanceof Response) return e;
		return apiError("INTERNAL_ERROR");
	}
}

registry.registerPath({
	method: "get",
	path: "/api/invoices/{id}",
	tags: ["Invoices"],
	summary: "Get invoice by ID",
	request: { params: paramsSchema },
	responses: {
		200: {
			description: "Invoice details",
			content: {
				"application/json": { schema: selectInvoiceWithPatientSchema },
			},
		},
	},
});

registry.registerPath({
	method: "patch",
	path: "/api/invoices/{id}",
	tags: ["Invoices"],
	summary: "Update invoice (items, notes, or cancel)",
	request: {
		params: paramsSchema,
		body: { content: { "application/json": { schema: updateSchema } } },
	},
	responses: {
		200: {
			description: "Updated invoice",
			content: {
				"application/json": { schema: selectInvoiceWithItemsSchema },
			},
		},
	},
});

registry.registerPath({
	method: "delete",
	path: "/api/invoices/{id}",
	tags: ["Invoices"],
	summary: "Cancel an invoice",
	request: { params: paramsSchema },
	responses: {
		200: {
			description: "Cancelled invoice",
			content: {
				"application/json": { schema: selectInvoiceWithPatientSchema },
			},
		},
	},
});
