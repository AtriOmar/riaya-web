import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
	DEV_PAYMENT_LIFESPAN_MS,
	getDevPayment,
	isBillingDevBypass,
} from "@/lib/konnect-dev";
import { DevPayClient } from "./dev-pay-client";

type Props = {
	searchParams: Promise<{ payment_ref?: string }>;
};

export async function generateMetadata({
	searchParams,
}: Props): Promise<Metadata> {
	const { payment_ref: paymentRef } = await searchParams;
	const payment = paymentRef ? getDevPayment(paymentRef) : null;
	if (!payment) return { title: "Konnect Gateway" };

	const amount = (payment.amountMillimes / 1000).toLocaleString("en-US", {
		maximumFractionDigits: 3,
	});
	return { title: `Pay Riaya ${amount} TND via Konnect` };
}

export default async function DevPayPage({ searchParams }: Props) {
	if (!isBillingDevBypass()) notFound();

	const { payment_ref: paymentRef } = await searchParams;
	if (!paymentRef) notFound();

	const payment = getDevPayment(paymentRef);
	if (!payment) notFound();

	return (
		<DevPayClient
			paymentRef={payment.paymentRef}
			description={payment.description}
			amountMillimes={payment.amountMillimes}
			expiresAt={payment.createdAt + DEV_PAYMENT_LIFESPAN_MS}
			alreadyCompleted={payment.status === "completed"}
		/>
	);
}
