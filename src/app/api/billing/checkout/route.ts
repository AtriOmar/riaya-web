// POST /api/billing/checkout — start Konnect payment for Pro upgrade / renewal
// With BILLING_DEV_BYPASS=true, initPayment returns a fake /dev/pay URL that
// still completes via the real /api/webhooks/konnect webhook.

import { addMonths } from "date-fns";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { user } from "@/db/auth-schema";
import { billingInvoice, subscription } from "@/db/schema";
import { getDoctorProfile, json, requireSession } from "@/lib/api-utils";
import { nextBillingInvoiceNumber, upgradeOrderId } from "@/lib/billing";
import { apiError } from "@/lib/errors";
import { initPayment } from "@/lib/konnect";
import { PLAN_IDS, PLANS, type PlanId } from "@/lib/plans";

const APP_URL =
	process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
	"http://localhost:3000";

export async function POST(req: Request) {
	try {
		const session = await requireSession();
		const profile = await getDoctorProfile(session.user.id);
		if (!profile) return apiError("DOCTOR_PROFILE_NOT_FOUND");

		const body = (await req.json().catch(() => ({}))) as { planId?: string };
		const planId = (body.planId ?? "pro") as PlanId;

		if (!PLAN_IDS.includes(planId) || planId === "free") {
			return apiError("VALIDATION_ERROR", {
				message: "Only paid plans can be checked out.",
			});
		}

		const plan = PLANS[planId];
		const now = new Date();

		// Ensure a subscription row exists (free until payment succeeds)
		let [sub] = await db
			.select()
			.from(subscription)
			.where(eq(subscription.doctorId, profile.id));

		if (!sub) {
			[sub] = await db
				.insert(subscription)
				.values({ doctorId: profile.id, planId: "free", status: "active" })
				.returning();
		}

		// Already on this plan and active with a valid period
		if (sub.planId === planId && sub.status === "active") {
			const stillValid = !sub.currentPeriodEnd || sub.currentPeriodEnd > now;
			if (stillValid) {
				return json({ alreadyActive: true, payUrl: null });
			}
		}

		const [docUser] = await db
			.select({ name: user.name, email: user.email })
			.from(user)
			.where(eq(user.id, profile.userId));

		const [firstName, ...rest] = (docUser?.name ?? "").split(" ");
		const lastName = rest.join(" ");

		const isFirstUpgrade = sub.planId === "free";

		// ── First-time upgrade: payment only, no invoice yet ──────────────────
		if (isFirstUpgrade) {
			const payment = await initPayment({
				amountMillimes: plan.priceTnd * 1000,
				description: `Riaya ${plan.name}`,
				webhookUrl: `${APP_URL}/api/webhooks/konnect`,
				firstName: firstName || undefined,
				lastName: lastName || undefined,
				email: docUser?.email ?? undefined,
				orderId: upgradeOrderId(sub.id),
			});

			return json({ payUrl: payment.payUrl, reused: false });
		}

		// ── Renewal: reuse or create an open invoice, then pay ────────────────
		const [existing] = await db
			.select()
			.from(billingInvoice)
			.where(
				and(
					eq(billingInvoice.subscriptionId, sub.id),
					eq(billingInvoice.status, "open"),
				),
			);

		if (existing?.konnectPayUrl) {
			return json({
				payUrl: existing.konnectPayUrl,
				invoiceId: existing.id,
				reused: true,
			});
		}

		const periodStart =
			sub.currentPeriodEnd && sub.currentPeriodEnd > now
				? sub.currentPeriodEnd
				: now;
		const periodEnd = addMonths(periodStart, 1);
		const amountMillimes = plan.priceTnd * 1000;

		const [invoice] =
			existing != null
				? [existing]
				: await db
						.insert(billingInvoice)
						.values({
							doctorId: profile.id,
							subscriptionId: sub.id,
							number: await nextBillingInvoiceNumber(),
							status: "open",
							amountMillimes,
							periodStart,
							periodEnd,
							dueDate: periodEnd,
						})
						.returning();

		const payment = await initPayment({
			amountMillimes: invoice.amountMillimes,
			description: `Riaya ${plan.name} – ${invoice.number}`,
			webhookUrl: `${APP_URL}/api/webhooks/konnect`,
			firstName: firstName || undefined,
			lastName: lastName || undefined,
			email: docUser?.email ?? undefined,
			orderId: String(invoice.id),
		});

		await db
			.update(billingInvoice)
			.set({
				konnectPaymentRef: payment.paymentRef,
				konnectPayUrl: payment.payUrl,
				updatedAt: new Date(),
			})
			.where(eq(billingInvoice.id, invoice.id));

		return json({
			payUrl: payment.payUrl,
			invoiceId: invoice.id,
			reused: false,
		});
	} catch (err) {
		if (err instanceof Response) return err;
		console.error("[billing/checkout POST]", err);
		return apiError("INTERNAL_ERROR");
	}
}
