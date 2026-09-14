// ─── Konnect.network API client ───────────────────────────────────────────────
// Docs: https://docs.konnect.network/docs/en/api-integration/intro
//
// Environment variables required:
//   KONNECT_API_KEY       — from Konnect dashboard
//   KONNECT_API_ENDPOINT  — e.g. https://api.sandbox.konnect.network/api/v2/
//   KONNECT_WALLET_ID     — receiverWalletId from Konnect dashboard
//
// Temporary: BILLING_DEV_BYPASS=true uses a local fake gateway that still
// fires /api/webhooks/konnect after a simulated payment.

import {
	createDevPayment,
	getDevPaymentDetails,
	isBillingDevBypass,
	isDevPaymentRef,
} from "@/lib/konnect-dev";

const BASE_URL = process.env.KONNECT_API_ENDPOINT?.replace(/\/$/, "") ?? "";
const API_KEY = process.env.KONNECT_API_KEY ?? "";
const WALLET_ID = process.env.KONNECT_WALLET_ID ?? "";

function konnectHeaders() {
	return {
		"Content-Type": "application/json",
		"x-api-key": API_KEY,
	};
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type InitPaymentParams = {
	/** Amount in millimes (1 TND = 1000 millimes) */
	amountMillimes: number;
	description: string;
	/** Webhook URL to receive status change pings */
	webhookUrl: string;
	/** Optional: pre-fill checkout form */
	firstName?: string;
	lastName?: string;
	email?: string;
	phoneNumber?: string;
	/** Custom reference stored on your side (e.g. billingInvoice id) */
	orderId?: string;
};

export type InitPaymentResult = {
	/** Direct URL where the doctor completes payment */
	payUrl: string;
	/** Konnect reference to store and look up later */
	paymentRef: string;
};

export type KonnectPaymentStatus =
	| "completed" // payment successful
	| "pending"; // not yet paid / failed

export type PaymentDetails = {
	id: string;
	status: KonnectPaymentStatus;
	amountDue: number;
	reachedAmount: number;
	amount: number;
	token: string;
	orderId?: string;
	expirationDate?: string;
};

// ─── Initiate Payment ─────────────────────────────────────────────────────────

export async function initPayment(
	params: InitPaymentParams,
): Promise<InitPaymentResult> {
	if (isBillingDevBypass()) {
		return createDevPayment({
			amountMillimes: params.amountMillimes,
			description: params.description,
			webhookUrl: params.webhookUrl,
			orderId: params.orderId,
		});
	}

	if (!BASE_URL || !API_KEY || !WALLET_ID) {
		throw new Error(
			"Konnect env vars missing: KONNECT_API_ENDPOINT, KONNECT_API_KEY, KONNECT_WALLET_ID",
		);
	}

	const res = await fetch(`${BASE_URL}/payments/init-payment`, {
		method: "POST",
		headers: konnectHeaders(),
		body: JSON.stringify({
			receiverWalletId: WALLET_ID,
			token: "TND",
			amount: params.amountMillimes,
			type: "immediate",
			description: params.description,
			acceptedPaymentMethods: ["wallet", "bank_card", "e-DINAR"],
			lifespan: 60, // minutes — Konnect max is 60
			checkoutForm: true,
			addPaymentFeesToAmount: false,
			firstName: params.firstName,
			lastName: params.lastName,
			email: params.email,
			phoneNumber: params.phoneNumber,
			orderId: params.orderId,
			webhook: params.webhookUrl,
		}),
	});

	if (!res.ok) {
		const text = await res.text().catch(() => res.statusText);
		throw new Error(`Konnect initPayment failed [${res.status}]: ${text}`);
	}

	const data = (await res.json()) as { payUrl: string; paymentRef: string };
	return { payUrl: data.payUrl, paymentRef: data.paymentRef };
}

// ─── Get Payment Details ──────────────────────────────────────────────────────

export async function getPaymentDetails(
	paymentRef: string,
): Promise<PaymentDetails> {
	if (isBillingDevBypass() && isDevPaymentRef(paymentRef)) {
		return getDevPaymentDetails(paymentRef);
	}

	if (!BASE_URL || !API_KEY) {
		throw new Error(
			"Konnect env vars missing: KONNECT_API_ENDPOINT, KONNECT_API_KEY",
		);
	}

	const res = await fetch(`${BASE_URL}/payments/${paymentRef}`, {
		method: "GET",
		headers: konnectHeaders(),
	});

	if (!res.ok) {
		const text = await res.text().catch(() => res.statusText);
		throw new Error(
			`Konnect getPaymentDetails failed [${res.status}]: ${text}`,
		);
	}

	const data = (await res.json()) as { payment: PaymentDetails };
	return data.payment;
}
