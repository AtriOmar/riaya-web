"use client";

// Stand-in for the bank's hosted card page that Konnect redirects to after
// "Bank Card" / "E-Dinar Card". Styled after Konnect's own secondary pages.
// Card details stay in the browser: only the paymentRef ever reaches our API.

import { Loader2 } from "lucide-react";
import { type FormEvent, useState } from "react";
import { cn } from "@/lib/utils";
import { ErrorIcon, inputBase } from "./konnect-ui";

export type CardMethod = "bank_card" | "e_dinar";

type CardField = "number" | "expiry" | "cvv" | "name";
type CardValues = Record<CardField, string>;
type CardErrors = Partial<Record<CardField, string>>;

/** Passes every check but the "bank" refuses it, to exercise the failure path. */
export const DECLINED_TEST_CARD = "4000000000000002";

const PROCESSING_DELAY_MS = 1200;

function isAmex(number: string) {
	return /^3[47]/.test(number);
}

function passesLuhn(number: string) {
	let sum = 0;
	for (let i = 0; i < number.length; i++) {
		let digit = Number(number[number.length - 1 - i]);
		if (i % 2 === 1) {
			digit *= 2;
			if (digit > 9) digit -= 9;
		}
		sum += digit;
	}
	return sum % 10 === 0;
}

function formatCardNumber(number: string) {
	if (isAmex(number)) {
		return [number.slice(0, 4), number.slice(4, 10), number.slice(10, 15)]
			.filter(Boolean)
			.join(" ");
	}
	return number.replace(/(\d{4})(?=\d)/g, "$1 ");
}

function formatExpiry(digits: string) {
	return digits.length > 2
		? `${digits.slice(0, 2)} / ${digits.slice(2)}`
		: digits;
}

export function validateCard(
	values: CardValues,
	method: CardMethod,
	today: Date,
): CardErrors {
	const errors: CardErrors = {};
	const { number, expiry, cvv } = values;

	const validLength =
		method === "e_dinar"
			? number.length === 16
			: isAmex(number)
				? number.length === 15
				: number.length >= 13 && number.length <= 19;
	if (!number) errors.number = "This field is required";
	else if (!validLength || !passesLuhn(number))
		errors.number = "Invalid card number";

	if (!expiry) errors.expiry = "This field is required";
	else {
		const month = Number(expiry.slice(0, 2));
		const year = 2000 + Number(expiry.slice(2, 4));
		// A card is valid through the last day of its expiry month
		const firstDayAfterExpiry = new Date(year, month, 1);
		if (expiry.length !== 4 || month < 1 || month > 12)
			errors.expiry = "Invalid expiry date";
		else if (firstDayAfterExpiry <= today)
			errors.expiry = "This card has expired";
		else if (year > today.getFullYear() + 20)
			errors.expiry = "Invalid expiry date";
	}

	const cvvLength = isAmex(number) ? 4 : 3;
	if (!cvv) errors.cvv = "This field is required";
	else if (cvv.length !== cvvLength) errors.cvv = "Invalid security code";

	if (!values.name.trim()) errors.name = "This field is required";

	return errors;
}

export function CardStep({
	method,
	amount,
	remaining,
	expired,
	defaultName,
	onBack,
	onPay,
}: {
	method: CardMethod;
	amount: string;
	remaining: string;
	expired: boolean;
	defaultName: string;
	onBack: () => void;
	/** Resolves when the payment went through; on failure it handles the error itself. */
	onPay: () => Promise<boolean>;
}) {
	const [values, setValues] = useState<CardValues>({
		number: "",
		expiry: "",
		cvv: "",
		name: defaultName,
	});
	const [errors, setErrors] = useState<CardErrors>({});
	const [submitted, setSubmitted] = useState(false);
	const [processing, setProcessing] = useState(false);
	const [declined, setDeclined] = useState(false);

	const disabled = processing || expired;
	const maxNumberLength =
		method === "e_dinar" ? 16 : isAmex(values.number) ? 15 : 19;

	function setField(field: CardField, value: string) {
		const next = { ...values, [field]: value };
		setValues(next);
		setDeclined(false);
		if (submitted) setErrors(validateCard(next, method, new Date()));
	}

	async function submit(e: FormEvent<HTMLFormElement>) {
		e.preventDefault();
		setSubmitted(true);
		const nextErrors = validateCard(values, method, new Date());
		setErrors(nextErrors);
		if (Object.keys(nextErrors).length > 0) return;

		setProcessing(true);
		await new Promise((resolve) => setTimeout(resolve, PROCESSING_DELAY_MS));

		if (values.number === DECLINED_TEST_CARD) {
			setDeclined(true);
			setProcessing(false);
			return;
		}

		// On success the page navigates away, so stay in the processing state
		if (!(await onPay())) setProcessing(false);
	}

	function fieldBorder(field: CardField) {
		return errors[field]
			? "border border-red-600"
			: "border-[#e5e7eb] focus:border focus:border-blue-600";
	}

	return (
		<div className="flex min-h-screen items-center justify-center bg-[#f7f6fa] p-4 font-[family-name:var(--font-geist-sans)] text-[#333]">
			<div className="w-full max-w-[800px]">
				<div className="rounded-md bg-white p-6 shadow-sm sm:p-8">
					{/* biome-ignore lint/performance/noImgElement: static dev-only asset */}
					<img
						src="/dev/konnect/konnect-logo.png"
						alt="konnect logo"
						className="h-6"
					/>

					<form
						onSubmit={submit}
						noValidate
						className="mx-auto mt-8 flex w-full max-w-sm flex-col"
					>
						<div className="flex flex-row items-end justify-between">
							<div>
								<p className="text-[13px] font-extralight leading-[19.5px]">
									You will pay
								</p>
								<p className="whitespace-nowrap font-bold">
									<span className="text-2xl font-semibold">{amount}</span>{" "}
									<sup className="text-[18px] font-light">TND</sup>
								</p>
							</div>
							<div className="text-right">
								<p className="text-[13px] font-extralight leading-[19.5px]">
									This payment expires in
								</p>
								<b suppressHydrationWarning>{remaining}</b>
							</div>
						</div>

						<div className="mt-8 flex flex-row items-center justify-between">
							<p className="text-xl font-bold text-[#03003a]">Card details</p>
							{/* biome-ignore lint/performance/noImgElement: static dev-only asset */}
							<img
								src={
									method === "e_dinar"
										? "/dev/konnect/la-poste.svg"
										: "/dev/konnect/bank-cards.svg"
								}
								alt={method === "e_dinar" ? "La poste logo" : "Card logos"}
								className="h-5 object-contain saturate-[120%]"
							/>
						</div>

						<div className="mt-4 flex flex-col">
							<div className="relative">
								<input
									type="text"
									inputMode="numeric"
									autoComplete="cc-number"
									placeholder="Card Number"
									aria-label="Card number"
									disabled={disabled}
									value={formatCardNumber(values.number)}
									onChange={(e) =>
										setField(
											"number",
											e.target.value
												.replace(/\D/g, "")
												.slice(0, maxNumberLength),
										)
									}
									aria-invalid={!!errors.number}
									className={cn(
										inputBase,
										"rounded-t-md border-x border-t tracking-wide",
										fieldBorder("number"),
									)}
								/>
								{errors.number && (
									<ErrorIcon
										message={errors.number}
										className="top-2 right-3"
									/>
								)}
							</div>
							<div className="grid grid-cols-2">
								<div className="relative">
									<input
										type="text"
										inputMode="numeric"
										autoComplete="cc-exp"
										placeholder="MM / YY"
										aria-label="Expiry date"
										disabled={disabled}
										value={formatExpiry(values.expiry)}
										onChange={(e) =>
											setField(
												"expiry",
												e.target.value.replace(/\D/g, "").slice(0, 4),
											)
										}
										aria-invalid={!!errors.expiry}
										className={cn(
											inputBase,
											"border-x border-t",
											fieldBorder("expiry"),
										)}
									/>
									{errors.expiry && (
										<ErrorIcon
											message={errors.expiry}
											className="top-2 right-3"
										/>
									)}
								</div>
								<div className="relative">
									<input
										type="password"
										inputMode="numeric"
										autoComplete="cc-csc"
										placeholder={
											isAmex(values.number) ? "CVV (4 digits)" : "CVV"
										}
										aria-label="Security code"
										disabled={disabled}
										value={values.cvv}
										onChange={(e) =>
											setField(
												"cvv",
												e.target.value
													.replace(/\D/g, "")
													.slice(0, isAmex(values.number) ? 4 : 3),
											)
										}
										aria-invalid={!!errors.cvv}
										className={cn(
											inputBase,
											"border-t border-r",
											fieldBorder("cvv"),
										)}
									/>
									{errors.cvv && (
										<ErrorIcon message={errors.cvv} className="top-2 right-3" />
									)}
								</div>
							</div>
							<div className="relative">
								<input
									type="text"
									autoComplete="cc-name"
									placeholder="Cardholder Name"
									aria-label="Cardholder name"
									disabled={disabled}
									value={values.name}
									onChange={(e) => setField("name", e.target.value)}
									aria-invalid={!!errors.name}
									className={cn(
										inputBase,
										"rounded-b-md border",
										fieldBorder("name"),
									)}
								/>
								{errors.name && (
									<ErrorIcon message={errors.name} className="top-2 right-3" />
								)}
							</div>
						</div>

						{declined && (
							<div
								role="alert"
								className="mt-4 rounded-md border border-red-600/20 bg-red-50 px-3 py-2 text-sm text-red-700"
							>
								<p className="font-semibold">Payment declined</p>
								<p className="text-xs">
									Your bank refused this transaction. Try another card.
								</p>
							</div>
						)}
						{expired && (
							<div
								role="alert"
								className="mt-4 rounded-md border border-red-600/20 bg-red-50 px-3 py-2 text-sm text-red-700"
							>
								This payment has expired.
							</div>
						)}

						<div className="mt-8 flex flex-row justify-center gap-4">
							<button
								type="button"
								onClick={onBack}
								disabled={processing}
								className="h-10 rounded-sm bg-[#e2e2e2] px-4 transition-colors hover:bg-[#d4d4d4] disabled:cursor-progress disabled:opacity-70"
							>
								Go back
							</button>
							<button
								type="submit"
								disabled={disabled}
								className="inline-flex h-10 min-w-36 items-center justify-center gap-2 rounded-sm bg-[#c2f915] px-4 text-black transition-colors hover:bg-[#b2e60f] disabled:cursor-progress disabled:opacity-80"
							>
								{processing ? (
									<>
										<Loader2 className="size-4 animate-spin" />
										Processing…
									</>
								) : (
									`Pay ${amount} TND`
								)}
							</button>
						</div>
					</form>
				</div>

				<p className="mt-4 text-center text-xs opacity-60">
					Dev gateway: any valid card is accepted. Use 4000 0000 0000 0002 to
					simulate a declined payment.
				</p>
			</div>
		</div>
	);
}
