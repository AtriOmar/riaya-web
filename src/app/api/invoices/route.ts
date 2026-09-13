import { and, desc, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { invoice, invoiceItem, patient } from "@/db/schema";
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
import { nextInvoiceNumber } from "@/lib/invoice-server";
import { registry } from "@/lib/openapi";

const itemSchema = z.object({
	description: z.string().min(1),
	quantity: z.coerce.number().int().positive().default(1),
	unitPriceCentimes: z.coerce.number().int().nonnegative(),
});

const createSchema = z.object({
	patientId: z.coerce.number().int().positive(),
	appointmentId: z.coerce.number().int().positive().optional(),
	notes: z.string().optional(),
	items: z.array(itemSchema).min(1),
});

const listQuerySchema = z.object({
	patientId: z.coerce.number().int().positive().optional(),
	status: z.enum(["unpaid", "partially_paid", "paid", "cancelled"]).optional(),
});

// ─── GET /api/invoices ────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
	try {
		const session = await requireSession();
		const profile = await requireDoctorProfile(session.user.id);

		const params = Object.fromEntries(req.nextUrl.searchParams);
		const parsed = listQuerySchema.safeParse(params);
		if (!parsed.success) return validationError(parsed.error.issues);

		const conditions = [eq(invoice.doctorId, profile.id)];
		if (parsed.data.patientId) {
			conditions.push(eq(invoice.patientId, parsed.data.patientId));
		}
		if (parsed.data.status) {
			conditions.push(eq(invoice.status, parsed.data.status));
		}

		const invoices = await db.query.invoice.findMany({
			where: and(...conditions),
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
			orderBy: [desc(invoice.issuedAt), desc(invoice.id)],
		});

		return json(invoices);
	} catch (e) {
		if (e instanceof Response) return e;
		return apiError("INTERNAL_ERROR");
	}
}

// ─── POST /api/invoices ───────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
	try {
		const session = await requireSession();
		const profile = await requireDoctorProfile(session.user.id);

		const body = await req.json();
		const parsed = createSchema.safeParse(body);
		if (!parsed.success) return validationError(parsed.error.issues);

		const [foundPatient] = await db
			.select({ id: patient.id })
			.from(patient)
			.where(
				and(
					eq(patient.id, parsed.data.patientId),
					eq(patient.doctorId, profile.id),
				),
			);

		if (!foundPatient) return apiError("PATIENT_NOT_FOUND");

		const totalCentimes = sumItemsCentimes(parsed.data.items);
		const number = await nextInvoiceNumber(profile.id);

		const created = await db.transaction(async (tx) => {
			const [row] = await tx
				.insert(invoice)
				.values({
					doctorId: profile.id,
					patientId: foundPatient.id,
					appointmentId: parsed.data.appointmentId,
					number,
					status: "unpaid",
					totalCentimes,
					amountPaidCentimes: 0,
					paymentMethod: null,
					notes: parsed.data.notes ?? null,
					issuedAt: new Date(),
					paidAt: null,
				})
				.returning();

			const items = await tx
				.insert(invoiceItem)
				.values(
					parsed.data.items.map((item) => ({
						invoiceId: row.id,
						description: item.description,
						quantity: item.quantity,
						unitPriceCentimes: item.unitPriceCentimes,
					})),
				)
				.returning();

			return { ...row, items, payments: [] };
		});

		return json(created, 201);
	} catch (e) {
		if (e instanceof Response) return e;
		return apiError("INTERNAL_ERROR");
	}
}

registry.registerPath({
	method: "get",
	path: "/api/invoices",
	tags: ["Invoices"],
	summary: "List invoices for the authenticated doctor",
	request: { query: listQuerySchema },
	responses: {
		200: {
			description: "Invoice list",
			content: {
				"application/json": {
					schema: z.array(selectInvoiceWithPatientSchema),
				},
			},
		},
	},
});

registry.registerPath({
	method: "post",
	path: "/api/invoices",
	tags: ["Invoices"],
	summary: "Create an invoice",
	request: {
		body: { content: { "application/json": { schema: createSchema } } },
	},
	responses: {
		201: {
			description: "Created invoice",
			content: {
				"application/json": { schema: selectInvoiceWithItemsSchema },
			},
		},
	},
});
