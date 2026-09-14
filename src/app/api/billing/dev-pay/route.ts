// POST /api/billing/dev-pay — simulate a successful Konnect payment (dev only)

import { json, requireSession } from "@/lib/api-utils";
import { apiError } from "@/lib/errors";
import {
	completeDevPayment,
	getDevPayment,
	isBillingDevBypass,
} from "@/lib/konnect-dev";

export async function POST(req: Request) {
	try {
		if (!isBillingDevBypass()) {
			return new Response("Not found", { status: 404 });
		}

		await requireSession();

		const body = (await req.json().catch(() => ({}))) as {
			paymentRef?: string;
		};
		const paymentRef = body.paymentRef?.trim();
		if (!paymentRef) {
			return apiError("VALIDATION_ERROR", { message: "paymentRef required" });
		}

		const payment = getDevPayment(paymentRef);
		if (!payment) {
			return apiError("PAYMENT_NOT_FOUND");
		}

		if (payment.status === "completed") {
			return json({ ok: true, alreadyCompleted: true });
		}

		const { webhookStatus } = await completeDevPayment(paymentRef);

		return json({
			ok: true,
			webhookStatus,
			redirectTo: "/dashboard/subscription",
		});
	} catch (err) {
		if (err instanceof Response) return err;
		console.error("[billing/dev-pay POST]", err);
		return apiError("INTERNAL_ERROR");
	}
}
