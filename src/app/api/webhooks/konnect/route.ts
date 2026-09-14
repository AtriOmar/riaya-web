// Konnect.network payment webhook
// Konnect sends a GET request with ?payment_ref=<ref> on every payment status change.
// Docs: https://docs.konnect.network/docs/en/api-integration/endpoints/webhook

import { addMonths } from "date-fns";
import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { db } from "@/db";
import { billingInvoice, subscription } from "@/db/schema";
import { nextBillingInvoiceNumber, parseUpgradeOrderId } from "@/lib/billing";
import { getPaymentDetails } from "@/lib/konnect";
import { PLANS } from "@/lib/plans";

export async function GET(req: NextRequest) {
	const paymentRef = req.nextUrl.searchParams.get("payment_ref");

	if (!paymentRef) {
		return new Response("Missing payment_ref", { status: 400 });
	}

	try {
		const payment = await getPaymentDetails(paymentRef);

		if (payment.status !== "completed") {
			return new Response("OK", { status: 200 });
		}

		const now = new Date();

		// ── Renewal path: invoice already exists ──────────────────────────────
		const [invoice] = await db
			.select()
			.from(billingInvoice)
			.where(eq(billingInvoice.konnectPaymentRef, paymentRef));

		if (invoice) {
			if (invoice.status === "paid") {
				return new Response("OK", { status: 200 });
			}

			await db
				.update(billingInvoice)
				.set({ status: "paid", paidAt: now, updatedAt: now })
				.where(eq(billingInvoice.id, invoice.id));

			if (invoice.subscriptionId) {
				await activatePro(invoice.subscriptionId, {
					periodStart: invoice.periodStart,
					periodEnd: invoice.periodEnd,
					now,
				});
			}

			console.info(
				`[konnect-webhook] Invoice ${invoice.id} (${invoice.number}) marked paid.`,
			);
			return new Response("OK", { status: 200 });
		}

		// ── First-time upgrade: no invoice yet — activate Pro, then create one ─
		const subId = parseUpgradeOrderId(payment.orderId);
		if (!subId) {
			console.warn(`[konnect-webhook] Unknown payment_ref: ${paymentRef}`);
			return new Response("OK", { status: 200 });
		}

		const [sub] = await db
			.select()
			.from(subscription)
			.where(eq(subscription.id, subId));

		if (!sub) {
			console.warn(`[konnect-webhook] Upgrade sub not found: ${subId}`);
			return new Response("OK", { status: 200 });
		}

		// Idempotency: already activated Pro for this period
		if (sub.planId === "pro" && sub.status === "active") {
			return new Response("OK", { status: 200 });
		}

		const periodStart = now;
		const periodEnd = addMonths(now, 1);
		const amountMillimes = payment.amount ?? PLANS.pro.priceTnd * 1000;

		await activatePro(sub.id, { periodStart, periodEnd, now });

		const [created] = await db
			.insert(billingInvoice)
			.values({
				doctorId: sub.doctorId,
				subscriptionId: sub.id,
				number: await nextBillingInvoiceNumber(),
				status: "paid",
				amountMillimes,
				konnectPaymentRef: paymentRef,
				konnectPayUrl: null,
				periodStart,
				periodEnd,
				dueDate: periodEnd,
				paidAt: now,
			})
			.returning();

		console.info(
			`[konnect-webhook] Upgrade paid — created invoice ${created.id} (${created.number}), activated Pro for sub ${sub.id}.`,
		);
		return new Response("OK", { status: 200 });
	} catch (err) {
		console.error("[konnect-webhook] Error processing webhook:", err);
		return new Response("OK", { status: 200 });
	}
}

async function activatePro(
	subscriptionId: number,
	opts: {
		periodStart: Date | null | undefined;
		periodEnd: Date | null | undefined;
		now: Date;
	},
) {
	const newStart = opts.periodStart ?? opts.now;
	const newEnd = opts.periodEnd ?? addMonths(newStart, 1);

	await db
		.update(subscription)
		.set({
			planId: "pro",
			status: "active",
			currentPeriodStart: newStart,
			currentPeriodEnd: newEnd,
			cancelAtPeriodEnd: false,
			updatedAt: opts.now,
		})
		.where(eq(subscription.id, subscriptionId));
}
