// Internal route called by the subscription BullMQ worker daily.
// Finds subscriptions expiring within 3 days and creates billing invoices for them.

import { and, between, eq, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { user } from "@/db/auth-schema";
import { billingInvoice, doctorProfile, subscription } from "@/db/schema";
import { json, requireInternal } from "@/lib/api-utils";
import { nextBillingInvoiceNumber } from "@/lib/billing";
import { apiError } from "@/lib/errors";
import { initPayment } from "@/lib/konnect";
import { PLANS, type PlanId } from "@/lib/plans";

const APP_URL =
	process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
	"http://localhost:3000";

export async function POST(req: Request) {
	try {
		await requireInternal(req);

		const now = new Date();
		const in3Days = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

		const expiring = await db
			.select({
				subscription: subscription,
				doctor: doctorProfile,
				user: { name: user.name, email: user.email },
			})
			.from(subscription)
			.innerJoin(doctorProfile, eq(doctorProfile.id, subscription.doctorId))
			.innerJoin(user, eq(user.id, doctorProfile.userId))
			.where(
				and(
					or(
						eq(subscription.status, "active"),
						eq(subscription.status, "past_due"),
					),
					sql`${subscription.planId} != 'free'`,
					between(subscription.currentPeriodEnd, now, in3Days),
				),
			);

		const results: { invoiceId: number; doctorId: number; created: boolean }[] =
			[];

		for (const row of expiring) {
			const { subscription: sub, doctor, user: docUser } = row;

			const [existingInvoice] = await db
				.select({ id: billingInvoice.id })
				.from(billingInvoice)
				.where(
					and(
						eq(billingInvoice.subscriptionId, sub.id),
						eq(billingInvoice.status, "open"),
						eq(billingInvoice.periodEnd, sub.currentPeriodEnd as Date),
					),
				);

			if (existingInvoice) {
				results.push({
					invoiceId: existingInvoice.id,
					doctorId: doctor.id,
					created: false,
				});
				continue;
			}

			const periodStart = sub.currentPeriodEnd ?? now;
			const periodEnd = new Date(periodStart);
			periodEnd.setMonth(periodEnd.getMonth() + 1);

			const plan = PLANS[sub.planId as PlanId];
			if (!plan) continue;

			const amountMillimes = plan.priceTnd * 1000;
			const invoiceNumber = await nextBillingInvoiceNumber();

			const [newInvoice] = await db
				.insert(billingInvoice)
				.values({
					doctorId: doctor.id,
					subscriptionId: sub.id,
					number: invoiceNumber,
					status: "open",
					amountMillimes,
					periodStart,
					periodEnd,
					dueDate: periodEnd,
				})
				.returning();

			try {
				const [firstName, ...rest] = (docUser.name ?? "").split(" ");
				const lastName = rest.join(" ");

				const payment = await initPayment({
					amountMillimes,
					description: `Riaya ${plan.name} – ${invoiceNumber}`,
					webhookUrl: `${APP_URL}/api/webhooks/konnect`,
					firstName: firstName || undefined,
					lastName: lastName || undefined,
					email: docUser.email ?? undefined,
					orderId: String(newInvoice.id),
				});

				await db
					.update(billingInvoice)
					.set({
						konnectPaymentRef: payment.paymentRef,
						konnectPayUrl: payment.payUrl,
						updatedAt: new Date(),
					})
					.where(eq(billingInvoice.id, newInvoice.id));
			} catch (konnectErr) {
				console.error(
					`[process-expiring] Konnect initPayment failed for invoice ${newInvoice.id}:`,
					konnectErr,
				);
			}

			results.push({
				invoiceId: newInvoice.id,
				doctorId: doctor.id,
				created: true,
			});
		}

		return json({ processed: results.length, results });
	} catch (err) {
		if (err instanceof Response) return err;
		console.error("[process-expiring]", err);
		return apiError("INTERNAL_ERROR");
	}
}
