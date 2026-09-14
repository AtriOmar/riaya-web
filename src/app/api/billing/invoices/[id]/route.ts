// POST /api/billing/invoices/[id]/pay — (re-)initiate Konnect payment for an open invoice

import { and, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { db } from "@/db";
import { user } from "@/db/auth-schema";
import { billingInvoice, subscription } from "@/db/schema";
import { getDoctorProfile, json, requireSession } from "@/lib/api-utils";
import { apiError } from "@/lib/errors";
import { initPayment } from "@/lib/konnect";
import { PLANS, type PlanId } from "@/lib/plans";

const APP_URL =
	process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
	"http://localhost:3000";

export async function POST(
	req: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	try {
		const session = await requireSession();
		const profile = await getDoctorProfile(session.user.id);
		if (!profile) return apiError("DOCTOR_PROFILE_NOT_FOUND");

		const { id } = await params;
		const invoiceId = parseInt(id, 10);
		if (isNaN(invoiceId)) return apiError("INVALID_ID");

		// Fetch the invoice and make sure it belongs to this doctor
		const [invoice] = await db
			.select()
			.from(billingInvoice)
			.where(
				and(
					eq(billingInvoice.id, invoiceId),
					eq(billingInvoice.doctorId, profile.id),
				),
			);

		if (!invoice) return apiError("BILLING_INVOICE_NOT_FOUND");

		if (invoice.status === "paid") {
			return json({ alreadyPaid: true, payUrl: null });
		}

		if (invoice.status === "cancelled") {
			return apiError("BILLING_INVOICE_CANCELLED");
		}

		// If there's an existing Konnect ref with a valid pay URL, return it
		if (invoice.konnectPayUrl && invoice.konnectPaymentRef) {
			return json({ payUrl: invoice.konnectPayUrl, reused: true });
		}

		// Otherwise, initiate a new Konnect payment
		const [docUser] = await db
			.select({ name: user.name, email: user.email })
			.from(user)
			.where(eq(user.id, profile.userId!));

		// Get plan from subscription if available
		let planName = "Pro";
		if (invoice.subscriptionId) {
			const [sub] = await db
				.select({ planId: subscription.planId })
				.from(subscription)
				.where(eq(subscription.id, invoice.subscriptionId));
			if (sub) {
				const plan = PLANS[sub.planId as PlanId];
				if (plan) planName = plan.name;
			}
		}

		const [firstName, ...rest] = (docUser?.name ?? "").split(" ");
		const lastName = rest.join(" ");

		const payment = await initPayment({
			amountMillimes: invoice.amountMillimes,
			description: `Riaya ${planName} – ${invoice.number}`,
			webhookUrl: `${APP_URL}/api/webhooks/konnect`,
			firstName: firstName || undefined,
			lastName: lastName || undefined,
			email: docUser?.email ?? undefined,
			orderId: String(invoice.id),
		});

		// Persist the new Konnect refs
		await db
			.update(billingInvoice)
			.set({
				konnectPaymentRef: payment.paymentRef,
				konnectPayUrl: payment.payUrl,
				updatedAt: new Date(),
			})
			.where(eq(billingInvoice.id, invoice.id));

		return json({ payUrl: payment.payUrl, reused: false });
	} catch (err) {
		if (err instanceof Response) return err;
		console.error("[billing/invoices/[id] POST]", err);
		return apiError("INTERNAL_ERROR");
	}
}
