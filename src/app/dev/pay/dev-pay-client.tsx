"use client";

// Pixel copy of the Konnect checkout page (gateway.konnect.network/pay), so the
// BILLING_DEV_BYPASS flow looks like the real thing. Raw inputs and hard-coded
// colours on purpose: this mirrors Konnect's UI, not ours.

import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { type CardMethod, CardStep } from "./card-step";
import { ErrorIcon, inputBase } from "./konnect-ui";

type Field = "firstName" | "lastName" | "phoneNumber" | "email";
type Errors = Partial<Record<Field, string>>;

const methodButton =
	"inline-flex h-10 min-h-12 w-full items-center justify-between gap-2 overflow-hidden whitespace-nowrap rounded-md border border-gray-400/10 bg-white px-4 text-sm font-semibold text-[#333] opacity-80 transition-colors hover:bg-[#c2f915] hover:text-neutral-900 focus:border focus:shadow-none focus:outline-none focus:ring-4 focus:ring-gray-300/50 disabled:cursor-progress disabled:opacity-80";

function formatAmount(amountMillimes: number) {
	return (amountMillimes / 1000).toLocaleString("en-US", {
		maximumFractionDigits: 3,
	});
}

function formatPhone(digits: string) {
	return [digits.slice(0, 2), digits.slice(2, 5), digits.slice(5, 8)]
		.filter(Boolean)
		.join(" ");
}

function formatRemaining(ms: number) {
	const total = Math.max(0, Math.floor(ms / 1000));
	const minutes = String(Math.floor(total / 60)).padStart(2, "0");
	const seconds = String(total % 60).padStart(2, "0");
	return `${minutes}:${seconds}`;
}

function validate(values: Record<Field, string>): Errors {
	const errors: Errors = {};
	if (!values.firstName.trim()) errors.firstName = "This field is required";
	if (!values.lastName.trim()) errors.lastName = "This field is required";
	if (!values.phoneNumber) errors.phoneNumber = "This field is required";
	else if (values.phoneNumber.length !== 8)
		errors.phoneNumber = "Invalid phone number";
	if (!values.email.trim()) errors.email = "This field is required";
	else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim()))
		errors.email = "Invalid email";
	return errors;
}

function ReceiverLogo() {
	return (
		<div className="relative size-10 shrink-0 overflow-hidden rounded-md">
			<div
				className="absolute inset-0 z-0 scale-150 bg-cover bg-center blur-lg"
				style={{ backgroundImage: "url(/logo.png)" }}
			/>
			<span className="absolute inset-0 flex size-10 shrink-0 overflow-hidden rounded-md border border-[#e5e7eb]">
				{/* biome-ignore lint/performance/noImgElement: mirrors Konnect markup */}
				<img
					className="aspect-square size-full object-contain"
					alt="Riaya"
					src="/logo.png"
				/>
			</span>
		</div>
	);
}

function CheckBadge({ className }: { className?: string }) {
	return (
		// biome-ignore lint/performance/noImgElement: static dev-only asset
		<img
			className={cn("ml-0.5 size-6", className)}
			alt="Green Badge Check Icon"
			title="Konnect confirms the authenticity of this profile"
			src="/dev/konnect/check-badge.svg"
		/>
	);
}

function Amount({ amount, className }: { amount: string; className: string }) {
	return (
		<p className={cn("my-2 whitespace-nowrap font-bold", className)}>
			<span className="font-semibold">{amount}</span>{" "}
			<sup className="text-[18px] font-light">TND</sup>
		</p>
	);
}

export function DevPayClient({
	paymentRef,
	description,
	amountMillimes,
	expiresAt,
	alreadyCompleted,
}: {
	paymentRef: string;
	description: string;
	amountMillimes: number;
	expiresAt: number;
	alreadyCompleted: boolean;
}) {
	const router = useRouter();
	const [values, setValues] = useState<Record<Field, string>>({
		firstName: "",
		lastName: "",
		phoneNumber: "",
		email: "",
	});
	const [errors, setErrors] = useState<Errors>({});
	const [submitted, setSubmitted] = useState(false);
	const [cardMethod, setCardMethod] = useState<CardMethod | null>(null);
	const [now, setNow] = useState(() => Date.now());

	useEffect(() => {
		const id = setInterval(() => setNow(Date.now()), 1000);
		return () => clearInterval(id);
	}, []);

	useEffect(() => {
		if (alreadyCompleted) router.replace("/dashboard/subscription");
	}, [alreadyCompleted, router]);

	const amount = formatAmount(amountMillimes);
	const remaining = formatRemaining(expiresAt - now);
	const expired = expiresAt <= now;
	const disabled = expired || alreadyCompleted;

	function setField(field: Field, value: string) {
		const next = { ...values, [field]: value };
		setValues(next);
		if (submitted) setErrors(validate(next));
	}

	function chooseMethod(e: FormEvent<HTMLFormElement>) {
		e.preventDefault();
		setSubmitted(true);
		const nextErrors = validate(values);
		setErrors(nextErrors);
		if (Object.keys(nextErrors).length > 0) return;

		const submitter = (e.nativeEvent as SubmitEvent).submitter;
		setCardMethod(
			submitter?.getAttribute("value") === "payWithEDinar"
				? "e_dinar"
				: "bank_card",
		);
	}

	async function completePayment(): Promise<boolean> {
		try {
			const res = await fetch("/api/billing/dev-pay", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ paymentRef }),
			});
			const data = (await res.json()) as {
				ok?: boolean;
				redirectTo?: string;
			};

			if (!res.ok || !data.ok) {
				toast.error("Failed to simulate payment.");
				return false;
			}

			router.push(data.redirectTo ?? "/dashboard/subscription");
			router.refresh();
			return true;
		} catch {
			toast.error("Failed to simulate payment.");
			return false;
		}
	}

	if (cardMethod) {
		return (
			<CardStep
				method={cardMethod}
				amount={amount}
				remaining={remaining}
				expired={expired}
				defaultName={`${values.firstName} ${values.lastName}`.trim()}
				onBack={() => setCardMethod(null)}
				onPay={completePayment}
			/>
		);
	}

	return (
		<div className="relative min-h-screen bg-[#f7f6fa] font-[family-name:var(--font-geist-sans)] text-[#333]">
			<div className="grid min-h-screen grid-cols-1 sm:grid-cols-2">
				{/* ── Summary ─────────────────────────────────────────────── */}
				<div className="flex size-full flex-col items-end lg:px-14 lg:pt-14">
					<div className="block w-full lg:hidden">
						<div className="flex w-full flex-col">
							<div className="flex w-full flex-row items-center p-6">
								<div className="flex flex-row items-center gap-x-2">
									<ReceiverLogo />
									<div className="flex flex-row items-center truncate">
										<p className="truncate font-semibold">Riaya</p>
										<CheckBadge className="cursor-pointer" />
									</div>
								</div>
							</div>
							<div className="flex w-full flex-col">
								<div className="mx-auto my-4 flex flex-row items-center gap-1 text-[13px] leading-[19.5px]">
									<svg
										xmlns="http://www.w3.org/2000/svg"
										fill="none"
										viewBox="0 0 24 24"
										strokeWidth={1.5}
										stroke="currentColor"
										aria-hidden="true"
										className="h-5"
									>
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											d="M12 20.25c4.97 0 9-3.694 9-8.25s-4.03-8.25-9-8.25S3 7.444 3 12c0 2.104.859 4.023 2.273 5.48.432.447.74 1.04.586 1.641a4.483 4.483 0 0 1-.923 1.785A5.969 5.969 0 0 0 6 21c1.282 0 2.47-.402 3.445-1.087.81.22 1.668.337 2.555.337Z"
										/>
									</svg>
									{description}
								</div>
								<div className="flex w-full flex-col items-center justify-center">
									<p className="text-[13px] font-extralight leading-[19.5px]">
										You will pay
									</p>
									<div className="flex w-auto flex-col">
										<Amount
											amount={amount}
											className="text-center text-[32px]"
										/>
										<div className="flex flex-row justify-between gap-5">
											<p className="text-[13px] font-extralight leading-[19.5px]">
												This payment expires in
											</p>
											<b suppressHydrationWarning>{remaining}</b>
										</div>
									</div>
								</div>
							</div>
						</div>
					</div>

					<div className="hidden w-full lg:flex lg:flex-row lg:justify-end">
						<div className="flex w-full flex-col sm:max-w-md">
							<div className="mb-4 flex flex-col">
								<div>
									<p className="text-[13px] font-extralight leading-[19.5px]">
										This payment expires in
									</p>
									<b suppressHydrationWarning>{remaining}</b>
								</div>
							</div>
							<div className="mx-auto flex w-full flex-row justify-between text-[13px] font-extralight leading-[19.5px]">
								<p>Receiver </p>
								<p className="text-right">You will pay</p>
							</div>
							<div className="mx-auto mt-2 mb-4 grid w-full grid-cols-2 items-center justify-between gap-x-4">
								<div className="flex flex-row items-center gap-x-2">
									<ReceiverLogo />
									<div className="flex flex-row items-center">
										<p className="truncate text-base font-medium" title="Riaya">
											Riaya
										</p>
										<CheckBadge />
									</div>
								</div>
								<Amount amount={amount} className="text-right text-2xl" />
							</div>
							<div className="mx-auto mt-4 flex whitespace-pre-line text-[13px] leading-[19.5px]">
								{description}
							</div>
						</div>
					</div>
				</div>

				{/* ── Checkout form ───────────────────────────────────────── */}
				<div className="flex size-full flex-col items-center justify-between gap-y-4 bg-[#f7f6fa] p-6 shadow-md sm:items-start sm:px-14 sm:pt-14 sm:pb-4">
					<form
						onSubmit={chooseMethod}
						noValidate
						className="flex w-full max-w-sm flex-1 flex-col gap-10"
					>
						<div className="flex flex-1 flex-col gap-y-5">
							<div>
								<p className="h-10 font-semibold">Payment method</p>
								<div className="flex flex-row gap-2">
									<button
										type="button"
										disabled={disabled}
										className="flex w-24 flex-col justify-center gap-y-0.5 rounded-md border-2 border-[#3d5170] px-2.5 py-1.5 font-semibold transition-colors duration-300 ease-in-out hover:bg-slate-200/20 disabled:cursor-progress"
									>
										{/* biome-ignore lint/performance/noImgElement: static dev-only asset */}
										<img
											src="/dev/konnect/card.svg"
											alt="Card"
											className="inline-block size-4 object-contain"
										/>
										<p className="text-[13px] leading-[19.5px] opacity-70">
											Card
										</p>
									</button>
								</div>
							</div>

							<div>
								<p className="pb-4 font-semibold">Contact information</p>
								<div className="flex flex-col gap-4">
									<div className="flex flex-col">
										<div className="grid grid-cols-2">
											<div className="relative block">
												<div className="relative flex-1">
													<input
														type="text"
														id="firstName"
														name="firstName"
														placeholder="First Name"
														autoComplete="given-name"
														disabled={disabled}
														value={values.firstName}
														onChange={(e) =>
															setField("firstName", e.target.value)
														}
														aria-invalid={!!errors.firstName}
														className={cn(
															inputBase,
															"rounded-tl-md border-x",
															errors.firstName
																? "border border-red-600"
																: "border-t border-[#e5e7eb] focus:border focus:border-blue-600",
														)}
													/>
													{errors.firstName && (
														<ErrorIcon
															message={errors.firstName}
															className="top-2 right-5"
														/>
													)}
												</div>
											</div>
											<div className="relative block">
												<div className="relative flex-1">
													<input
														type="text"
														id="lastName"
														name="lastName"
														placeholder="Last Name"
														autoComplete="family-name"
														disabled={disabled}
														value={values.lastName}
														onChange={(e) =>
															setField("lastName", e.target.value)
														}
														aria-invalid={!!errors.lastName}
														className={cn(
															inputBase,
															"rounded-tr-md",
															errors.lastName
																? "border border-red-600"
																: "border-t border-r border-[#e5e7eb] focus:border focus:border-blue-600",
														)}
													/>
													{errors.lastName && (
														<ErrorIcon
															message={errors.lastName}
															className="top-2 right-5"
														/>
													)}
												</div>
											</div>
										</div>

										<div className="relative">
											<div
												className={cn(
													"flex h-9 w-full flex-row bg-transparent",
													errors.phoneNumber &&
														"outline -outline-offset-1 outline-red-600",
												)}
											>
												<button
													type="button"
													tabIndex={-1}
													disabled={disabled}
													className="flex h-9 items-center justify-center gap-1 whitespace-nowrap rounded-none border border-r-0 border-neutral-200 bg-transparent px-3 py-2 text-sm font-medium transition-colors hover:bg-neutral-100 hover:text-neutral-900 focus:z-10 disabled:pointer-events-none disabled:opacity-50"
												>
													<span className="flex h-4 w-6 overflow-hidden rounded-sm">
														<svg
															xmlns="http://www.w3.org/2000/svg"
															viewBox="0 85.333 512 341.333"
															className="size-full"
														>
															<title>TN</title>
															<path
																fill="#D80027"
																d="M0 85.331h512v341.337H0z"
															/>
															<circle
																fill="#FFF"
																cx="256"
																cy="255.994"
																r="96"
															/>
															<g fill="#D80027">
																<path d="m267.826 219.291 16.47 22.695 26.673-8.649-16.496 22.676 16.468 22.695-26.664-8.681-16.495 22.676.017-28.04-26.664-8.682 26.674-8.648z" />
																<path d="M277.818 312.724c-31.33 0-56.727-25.397-56.727-56.727s25.397-56.727 56.727-56.727c9.769 0 18.96 2.47 26.985 6.819-12.589-12.31-29.804-19.909-48.803-19.909-38.558 0-69.818 31.259-69.818 69.818s31.26 69.818 69.818 69.818c18.999 0 36.215-7.599 48.803-19.909-8.026 4.347-17.216 6.817-26.985 6.817z" />
															</g>
														</svg>
													</span>
													<svg
														xmlns="http://www.w3.org/2000/svg"
														width="24"
														height="24"
														viewBox="0 0 24 24"
														fill="none"
														stroke="currentColor"
														strokeWidth="2"
														strokeLinecap="round"
														strokeLinejoin="round"
														className="-mr-2 size-4"
														aria-hidden="true"
													>
														<path d="m7 15 5 5 5-5" />
														<path d="m7 9 5-5 5 5" />
													</svg>
												</button>
												<input
													type="tel"
													inputMode="numeric"
													autoComplete="tel-national"
													placeholder="Phone Number"
													disabled={disabled}
													value={formatPhone(values.phoneNumber)}
													onChange={(e) =>
														setField(
															"phoneNumber",
															e.target.value.replace(/\D/g, "").slice(0, 8),
														)
													}
													aria-invalid={!!errors.phoneNumber}
													className={cn(
														inputBase,
														"flex rounded-none border border-[#e5e7eb]",
													)}
												/>
											</div>
											{errors.phoneNumber && (
												<ErrorIcon
													message={errors.phoneNumber}
													className="top-[0.45rem] right-[1.2rem]"
												/>
											)}
										</div>

										<div className="flex flex-col gap-1">
											<div className="relative block">
												<div className="relative flex-1">
													<input
														type="text"
														id="email"
														name="email"
														placeholder="Email"
														autoComplete="email"
														disabled={disabled}
														value={values.email}
														onChange={(e) => setField("email", e.target.value)}
														aria-invalid={!!errors.email}
														className={cn(
															inputBase,
															"rounded-b-md !pl-[4.5rem]",
															errors.email
																? "border border-red-600"
																: "border-x border-b border-[#e5e7eb] focus:border focus:border-blue-600",
														)}
													/>
													<svg
														xmlns="http://www.w3.org/2000/svg"
														fill="none"
														viewBox="0 0 24 24"
														strokeWidth={1.5}
														stroke="currentColor"
														aria-hidden="true"
														className="absolute top-1.5 left-4 h-6"
													>
														<path
															strokeLinecap="round"
															strokeLinejoin="round"
															d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75"
														/>
													</svg>
													{errors.email && (
														<ErrorIcon
															message={errors.email}
															className="top-2 right-5"
														/>
													)}
												</div>
											</div>
										</div>
									</div>
								</div>
							</div>

							<div className="flex flex-1 flex-col gap-y-4">
								<div className="flex flex-1 flex-col gap-4">
									<button
										type="submit"
										name="intent"
										value="payWithBankCard"
										disabled={disabled}
										className={methodButton}
									>
										<p>Bank Card</p>
										{/* biome-ignore lint/performance/noImgElement: static dev-only asset */}
										<img
											src="/dev/konnect/bank-cards.svg"
											alt="Visa and MasterCard logos"
											className="inline-block h-5 object-contain saturate-[120%] lg:h-6"
										/>
									</button>
									<button
										type="submit"
										name="intent"
										value="payWithEDinar"
										disabled={disabled}
										className={methodButton}
									>
										<p>E-Dinar Card</p>
										{/* biome-ignore lint/performance/noImgElement: static dev-only asset */}
										<img
											src="/dev/konnect/la-poste.svg"
											alt="La poste logo"
											className="inline-block h-5 object-contain saturate-[120%] lg:h-6"
										/>
									</button>
									<div className="mt-4 grid w-full grid-cols-12 items-stretch gap-x-3 rounded-md border border-[#03003a]/10 bg-[#c2f915]/20 px-3 py-2">
										<div className="col-span-2 h-full p-1">
											<svg
												xmlns="http://www.w3.org/2000/svg"
												width="24"
												height="24"
												viewBox="0 0 24 24"
												stroke="currentColor"
												strokeWidth="0.5"
												strokeLinecap="round"
												strokeLinejoin="round"
												className="size-full shrink-0 fill-[#c2f915]/50 object-contain text-[#03003a]/50"
												aria-hidden="true"
											>
												<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
												<path d="m9 12 2 2 4-4" />
											</svg>
										</div>
										<div className="col-span-10 text-xs opacity-80">
											Once you've clicked on the button, you'll be redirected to
											a secure page where you can complete your payment in total
											peace of mind.
										</div>
									</div>
								</div>
							</div>
						</div>
					</form>

					<div className="mt-10 flex w-full max-w-sm flex-row items-center justify-center">
						<a
							href="https://konnect.network/"
							target="_blank"
							rel="noreferrer"
							className="flex w-auto flex-row items-center justify-center gap-x-2 opacity-40 grayscale transition-all duration-200 ease-in-out hover:opacity-100 hover:grayscale-0"
						>
							<p className="text-xs">Powered by</p>
							{/* biome-ignore lint/performance/noImgElement: static dev-only asset */}
							<img
								src="/dev/konnect/konnect-logo.png"
								alt="konnect logo"
								className="inline-block h-3"
							/>
						</a>
					</div>
				</div>
			</div>
		</div>
	);
}
