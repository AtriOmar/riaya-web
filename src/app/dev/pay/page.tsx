import { notFound } from "next/navigation";
import {
	getDevPayment,
	isBillingDevBypass,
} from "@/lib/konnect-dev";
import { DevPayClient } from "./dev-pay-client";

export default async function DevPayPage({
	searchParams,
}: {
	searchParams: Promise<{ payment_ref?: string }>;
}) {
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
			alreadyCompleted={payment.status === "completed"}
		/>
	);
}
