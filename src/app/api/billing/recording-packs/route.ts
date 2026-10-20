// POST /api/billing/recording-packs — buy a recording time pack via Konnect.
// Creates an open `top_up` invoice (or reuses an unpaid one for the same pack);
// the Konnect webhook grants the hours once it's paid.

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { user } from "@/db/auth-schema";
import { billingInvoice } from "@/db/schema";
import {
	json,
	requireDoctorProfile,
	requireSession,
	validationError,
} from "@/lib/api-utils";
import { nextBillingInvoiceNumber } from "@/lib/billing";
import { apiError } from "@/lib/errors";
import { initPayment } from "@/lib/konnect";
import { getEffectivePlan } from "@/lib/plan-limits";
import { RECORDING_PACK_IDS, RECORDING_PACKS } from "@/lib/plans";

const APP_URL =
	process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
	"http://localhost:3000";

const bodySchema = z.object({
	packId: z.enum(RECORDING_PACK_IDS),
});

export async function POST(req: Request) {
	try {
		const session = await requireSession();
		const profile = await requireDoctorProfile(session.user.id);

		const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
		if (!parsed.success) return validationError(parsed.error.issues);

		const { plan } = await getEffectivePlan(profile.id);
		if (!plan.canBuyRecordingPacks) {
			return apiError("RECORDING_PACKS_REQUIRE_PRO");
		}

		const pack = RECORDING_PACKS[parsed.data.packId];
		const amountMillimes = pack.priceTnd * 1000;
		const creditSeconds = pack.hours * 3600;

		// An unpaid invoice for the same pack: send the doctor back to it
		const [existing] = await db
			.select()
			.from(billingInvoice)
			.where(
				and(
					eq(billingInvoice.doctorId, profile.id),
					eq(billingInvoice.kind, "top_up"),
					eq(billingInvoice.status, "open"),
					eq(billingInvoice.creditSeconds, creditSeconds),
					eq(billingInvoice.amountMillimes, amountMillimes),
				),
			);

		if (existing?.konnectPayUrl) {
			return json({ payUrl: existing.konnectPayUrl, invoiceId: existing.id });
		}

		const [invoice] = existing
			? [existing]
			: await db
					.insert(billingInvoice)
					.values({
						doctorId: profile.id,
						kind: "top_up",
						creditSeconds,
						number: await nextBillingInvoiceNumber(),
						status: "open",
						amountMillimes,
					})
					.returning();

		const [docUser] = await db
			.select({ name: user.name, email: user.email })
			.from(user)
			.where(eq(user.id, profile.userId));
		const [firstName, ...rest] = (docUser?.name ?? "").split(" ");

		const payment = await initPayment({
			amountMillimes,
			description: `Riaya ${pack.hours} h recording time – ${invoice.number}`,
			webhookUrl: `${APP_URL}/api/webhooks/konnect`,
			firstName: firstName || undefined,
			lastName: rest.join(" ") || undefined,
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

		return json({ payUrl: payment.payUrl, invoiceId: invoice.id });
	} catch (err) {
		if (err instanceof Response) return err;
		console.error("[billing/recording-packs POST]", err);
		return apiError("INTERNAL_ERROR");
	}
}

import { registry } from "@/lib/openapi";

registry.registerPath({
	method: "post",
	path: "/api/billing/recording-packs",
	tags: ["Billing"],
	summary: "Buy a recording time pack",
	request: {
		body: { content: { "application/json": { schema: bodySchema } } },
	},
	responses: {
		200: {
			description: "Konnect payment URL for the pack's invoice",
			content: {
				"application/json": {
					schema: z.object({ payUrl: z.string(), invoiceId: z.number() }),
				},
			},
		},
	},
});
