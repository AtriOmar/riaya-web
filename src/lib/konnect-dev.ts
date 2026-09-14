// Temporary fake Konnect gateway — only active when BILLING_DEV_BYPASS=true.
// Mimics: init payment → pay page → webhook GET ?payment_ref=

import type { PaymentDetails } from "@/lib/konnect";

export function isBillingDevBypass(): boolean {
	return process.env.BILLING_DEV_BYPASS === "true";
}

export function isDevPaymentRef(paymentRef: string): boolean {
	return paymentRef.startsWith("dev_");
}

type DevPayment = {
	paymentRef: string;
	status: "pending" | "completed";
	amountMillimes: number;
	description: string;
	orderId?: string;
	webhookUrl: string;
	createdAt: number;
};

const globalStore = globalThis as unknown as {
	__riayaDevKonnectPayments?: Map<string, DevPayment>;
};

function store(): Map<string, DevPayment> {
	if (!globalStore.__riayaDevKonnectPayments) {
		globalStore.__riayaDevKonnectPayments = new Map();
	}
	return globalStore.__riayaDevKonnectPayments;
}

const APP_URL =
	process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
	"http://localhost:3000";

export function createDevPayment(params: {
	amountMillimes: number;
	description: string;
	webhookUrl: string;
	orderId?: string;
}): { payUrl: string; paymentRef: string } {
	const paymentRef = `dev_${crypto.randomUUID().replace(/-/g, "")}`;

	store().set(paymentRef, {
		paymentRef,
		status: "pending",
		amountMillimes: params.amountMillimes,
		description: params.description,
		orderId: params.orderId,
		webhookUrl: params.webhookUrl,
		createdAt: Date.now(),
	});

	return {
		paymentRef,
		payUrl: `${APP_URL}/dev/pay?payment_ref=${encodeURIComponent(paymentRef)}`,
	};
}

export function getDevPayment(paymentRef: string): DevPayment | null {
	return store().get(paymentRef) ?? null;
}

export function getDevPaymentDetails(paymentRef: string): PaymentDetails {
	const payment = store().get(paymentRef);
	if (!payment) {
		throw new Error(`Dev payment not found: ${paymentRef}`);
	}

	return {
		id: payment.paymentRef,
		status: payment.status === "completed" ? "completed" : "pending",
		amountDue: payment.amountMillimes,
		reachedAmount:
			payment.status === "completed" ? payment.amountMillimes : 0,
		amount: payment.amountMillimes,
		token: "TND",
		orderId: payment.orderId,
	};
}

/** Mark completed and ping the real Konnect webhook URL (GET ?payment_ref=). */
export async function completeDevPayment(paymentRef: string): Promise<{
	webhookStatus: number;
}> {
	const payment = store().get(paymentRef);
	if (!payment) {
		throw new Error(`Dev payment not found: ${paymentRef}`);
	}

	payment.status = "completed";
	store().set(paymentRef, payment);

	const url = new URL(payment.webhookUrl);
	url.searchParams.set("payment_ref", paymentRef);

	const res = await fetch(url.toString(), { method: "GET" });
	return { webhookStatus: res.status };
}
