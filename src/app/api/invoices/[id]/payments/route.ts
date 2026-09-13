import { and, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { invoice, invoicePayment } from "@/db/schema";
import { selectInvoiceWithItemsSchema } from "@/db/zod";
import {
	apiError,
	json,
	requireDoctorProfile,
	requireSession,
	validationError,
} from "@/lib/api-utils";
import { PAYMENT_METHODS } from "@/lib/invoice";
import { syncInvoiceFromPayments } from "@/lib/invoice-server";
import { registry } from "@/lib/openapi";

const paramsSchema = z.object({ id: z.string() });

const createPaymentSchema = z.object({
	amountCentimes: z.coerce.number().int().positive(),
	paymentMethod: z.enum(PAYMENT_METHODS),
	paidAt: z.iso.datetime().optional(),
	notes: z.string().optional(),
});

const deleteQuerySchema = z.object({
	paymentId: z.coerce.number().int().positive(),
});

async function requireDoctorInvoice(invoiceId: number, doctorId: number) {
	const [row] = await db
		.select()
		.from(invoice)
		.where(and(eq(invoice.id, invoiceId), eq(invoice.doctorId, doctorId)));
	return row ?? null;
}

async function loadInvoiceBundle(invoiceId: number, doctorId: number) {
	return db.query.invoice.findFirst({
		where: and(eq(invoice.id, invoiceId), eq(invoice.doctorId, doctorId)),
		with: {
			items: true,
			payments: {
				orderBy: (p, { asc }) => [asc(p.paidAt), asc(p.id)],
			},
		},
	});
}

// ─── POST /api/invoices/[id]/payments ────────────────────────────────────────

export async function POST(
	req: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	try {
		const session = await requireSession();
		const profile = await requireDoctorProfile(session.user.id);

		const { id } = await params;
		const invoiceId = Number(id);
		if (Number.isNaN(invoiceId)) return apiError("INVALID_ID");

		const existing = await requireDoctorInvoice(invoiceId, profile.id);
		if (!existing) return apiError("INVOICE_NOT_FOUND");
		if (existing.status === "cancelled") return apiError("INVOICE_CANCELLED");

		const body = await req.json();
		const parsed = createPaymentSchema.safeParse(body);
		if (!parsed.success) return validationError(parsed.error.issues);

		const existingPayments = await db
			.select({ amountCentimes: invoicePayment.amountCentimes })
			.from(invoicePayment)
			.where(eq(invoicePayment.invoiceId, invoiceId));
		const paidSoFar = existingPayments.reduce(
			(sum, p) => sum + p.amountCentimes,
			0,
		);
		const remaining = Math.max(0, existing.totalCentimes - paidSoFar);
		if (parsed.data.amountCentimes > remaining) {
			return validationError([
				{
					path: ["amountCentimes"],
					message: `Amount exceeds remaining balance (${remaining} millimes)`,
				},
			]);
		}

		await db.transaction(async (tx) => {
			await tx.insert(invoicePayment).values({
				invoiceId,
				amountCentimes: parsed.data.amountCentimes,
				paymentMethod: parsed.data.paymentMethod,
				paidAt: parsed.data.paidAt ? new Date(parsed.data.paidAt) : new Date(),
				notes: parsed.data.notes ?? null,
			});

			await syncInvoiceFromPayments(
				tx,
				invoiceId,
				existing.totalCentimes,
				false,
			);
		});

		const record = await loadInvoiceBundle(invoiceId, profile.id);
		return json(record, 201);
	} catch (e) {
		if (e instanceof Response) return e;
		return apiError("INTERNAL_ERROR");
	}
}

// ─── DELETE /api/invoices/[id]/payments ───────────────────────────────────────

export async function DELETE(
	req: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	try {
		const session = await requireSession();
		const profile = await requireDoctorProfile(session.user.id);

		const { id } = await params;
		const invoiceId = Number(id);
		if (Number.isNaN(invoiceId)) return apiError("INVALID_ID");

		const existing = await requireDoctorInvoice(invoiceId, profile.id);
		if (!existing) return apiError("INVOICE_NOT_FOUND");
		if (existing.status === "cancelled") return apiError("INVOICE_CANCELLED");

		const query = Object.fromEntries(req.nextUrl.searchParams);
		const parsed = deleteQuerySchema.safeParse(query);
		if (!parsed.success) return validationError(parsed.error.issues);

		await db.transaction(async (tx) => {
			const [deleted] = await tx
				.delete(invoicePayment)
				.where(
					and(
						eq(invoicePayment.id, parsed.data.paymentId),
						eq(invoicePayment.invoiceId, invoiceId),
					),
				)
				.returning();

			if (!deleted) throw apiError("PAYMENT_NOT_FOUND");

			await syncInvoiceFromPayments(
				tx,
				invoiceId,
				existing.totalCentimes,
				false,
			);
		});

		const record = await loadInvoiceBundle(invoiceId, profile.id);
		return json(record);
	} catch (e) {
		if (e instanceof Response) return e;
		return apiError("INTERNAL_ERROR");
	}
}

registry.registerPath({
	method: "post",
	path: "/api/invoices/{id}/payments",
	tags: ["Invoices"],
	summary: "Add a payment to an invoice",
	request: {
		params: paramsSchema,
		body: { content: { "application/json": { schema: createPaymentSchema } } },
	},
	responses: {
		201: {
			description: "Invoice with updated payments",
			content: {
				"application/json": { schema: selectInvoiceWithItemsSchema },
			},
		},
	},
});

registry.registerPath({
	method: "delete",
	path: "/api/invoices/{id}/payments",
	tags: ["Invoices"],
	summary: "Remove a payment from an invoice",
	request: {
		params: paramsSchema,
		query: deleteQuerySchema,
	},
	responses: {
		200: {
			description: "Invoice with updated payments",
			content: {
				"application/json": { schema: selectInvoiceWithItemsSchema },
			},
		},
	},
});
