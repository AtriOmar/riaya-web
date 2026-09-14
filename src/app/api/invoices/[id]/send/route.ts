import { randomUUID } from "node:crypto";
import axios from "axios";
import { and, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { invoice } from "@/db/schema";
import { selectInvoiceWithItemsSchema } from "@/db/zod";
import {
	apiError,
	json,
	requireDoctorProfile,
	requireSession,
} from "@/lib/api-utils";
import { buildInvoicePdf } from "@/lib/invoice-pdf";
import { registry } from "@/lib/openapi";
import { assertAndRecordWhatsappSend } from "@/lib/plan-limits";
import { uploadBufferToR2 } from "@/lib/r2";

const paramsSchema = z.object({ id: z.string() });

// ─── POST /api/invoices/[id]/send ─────────────────────────────────────────────
// Generate invoice PDF, upload to R2, send via doctor's WhatsApp.

export async function POST(
	_req: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	try {
		const session = await requireSession();
		const profile = await requireDoctorProfile(session.user.id);

		const { id } = await params;
		const invoiceId = Number(id);
		if (Number.isNaN(invoiceId)) return apiError("INVALID_ID");

		const record = await db.query.invoice.findFirst({
			where: and(eq(invoice.id, invoiceId), eq(invoice.doctorId, profile.id)),
			with: {
				items: true,
				payments: {
					orderBy: (p, { asc }) => [asc(p.paidAt), asc(p.id)],
				},
				patient: true,
				doctor: {
					with: {
						speciality: true,
						cabinetCity: true,
					},
				},
			},
		});

		if (!record) return apiError("INVOICE_NOT_FOUND");
		if (record.status === "cancelled") return apiError("INVOICE_CANCELLED");
		if (!record.patient) return apiError("PATIENT_NOT_FOUND");
		if (!record.patient.phoneNumber) {
			return apiError("PATIENT_PHONE_REQUIRED");
		}

		const pdf = await buildInvoicePdf({
			number: record.number,
			status: record.status,
			currency: record.currency,
			totalCentimes: record.totalCentimes,
			amountPaidCentimes: record.amountPaidCentimes,
			notes: record.notes,
			issuedAt: record.issuedAt,
			items: record.items,
			payments: record.payments,
			doctor: {
				firstName: record.doctor?.firstName ?? null,
				lastName: record.doctor?.lastName ?? null,
				cabinetName: record.doctor?.cabinetName ?? null,
				address: record.doctor?.address ?? null,
				tin: record.doctor?.tin ?? null,
				medicalCouncilNumber: record.doctor?.medicalCouncilNumber ?? null,
				specialityName:
					record.doctor?.speciality?.frName ??
					record.doctor?.speciality?.enName ??
					null,
				cityName:
					record.doctor?.cabinetCity?.frName ??
					record.doctor?.cabinetCity?.enName ??
					null,
			},
			patient: {
				firstName: record.patient.firstName,
				lastName: record.patient.lastName,
				cin: record.patient.cin,
				phoneNumber: record.patient.phoneNumber,
				address: record.patient.address,
			},
		});

		const key = `invoices/${randomUUID()}.pdf`;
		const pdfUrl = await uploadBufferToR2(key, pdf, "application/pdf");

		const doctorLast =
			record.doctor?.lastName ||
			[record.doctor?.firstName, record.doctor?.lastName]
				.filter(Boolean)
				.join(" ") ||
			"votre médecin";
		const patientFirst = record.patient.firstName || "there";
		const caption = `Hello ${patientFirst},\n\nPlease find attached your invoice ${record.number} from Dr. ${doctorLast}.`;

		const realtimeUrl =
			process.env.SOCKET_INTERNAL_URL?.trim() ||
			process.env.NEXT_PUBLIC_REALTIME_URL?.trim();
		if (!realtimeUrl) {
			console.error(
				"SOCKET_INTERNAL_URL / NEXT_PUBLIC_REALTIME_URL is not set",
			);
			return apiError("INTERNAL_ERROR");
		}
		const httpUrl = realtimeUrl.replace(/^ws/, "http").replace(/\/$/, "");

		try {
			await assertAndRecordWhatsappSend(profile.id);
			await axios.post(`${httpUrl}/send-whatsapp`, {
				userId: session.user.id,
				phone: record.patient.phoneNumber,
				documentUrl: pdfUrl,
				fileName: `${record.number}.pdf`,
				message: caption,
				mimetype: "application/pdf",
				quotaConsumed: true,
			});
		} catch (err: unknown) {
			if (err instanceof Response) return err;
			const ax = err as { response?: { data?: unknown }; message?: string };
			console.error(
				"Failed to send invoice WhatsApp:",
				ax?.response?.data || ax?.message,
			);
			return apiError("WHATSAPP_SEND_FAILED");
		}

		const [updated] = await db
			.update(invoice)
			.set({
				pdfUrl,
				sentViaWhatsapp: true,
				updatedAt: new Date(),
			})
			.where(eq(invoice.id, invoiceId))
			.returning();

		const bundle = await db.query.invoice.findFirst({
			where: eq(invoice.id, invoiceId),
			with: {
				items: true,
				payments: {
					orderBy: (p, { asc }) => [asc(p.paidAt), asc(p.id)],
				},
			},
		});

		return json(bundle ?? { ...updated, items: [], payments: [] });
	} catch (e) {
		if (e instanceof Response) return e;
		console.error(e);
		return apiError("INTERNAL_ERROR");
	}
}

registry.registerPath({
	method: "post",
	path: "/api/invoices/{id}/send",
	tags: ["Invoices"],
	summary: "Generate invoice PDF and send via WhatsApp",
	request: { params: paramsSchema },
	responses: {
		200: {
			description: "Invoice after WhatsApp send",
			content: {
				"application/json": { schema: selectInvoiceWithItemsSchema },
			},
		},
	},
});
