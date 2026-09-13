"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Eye, EyeOff, Lock, Mail } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	InputOTP,
	InputOTPGroup,
	InputOTPSlot,
} from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import { getErrorMessage } from "@/lib/error-handling";
import {
	usePostApiRegisterRequestOtp,
	usePostApiRegisterResendOtp,
	usePostApiRegisterVerifyOtp,
} from "@/services/generated/auth/auth";

const registerSchema = z
	.object({
		email: z
			.string()
			.min(1, "Email is required")
			.email("Invalid email address"),
		password: z
			.string()
			.min(8, "Password must be at least 8 characters")
			.regex(/(?=.*[a-zA-Z])(?=.*[0-9])/, "Must contain letters and numbers"),
		confirmPassword: z.string(),
	})
	.refine((data) => data.password === data.confirmPassword, {
		message: "Passwords do not match",
		path: ["confirmPassword"],
	});

type RegisterValues = z.infer<typeof registerSchema>;
type Step = "form" | "otp";

const RESEND_COOLDOWN_SECONDS = 60;

export default function RegisterForm() {
	const [showPassword, setShowPassword] = useState(false);
	const [apiError, setApiError] = useState<string | null>(null);
	const [step, setStep] = useState<Step>("form");
	const [pendingEmail, setPendingEmail] = useState("");
	const [pendingPassword, setPendingPassword] = useState("");
	const [otp, setOtp] = useState("");
	const [resendSeconds, setResendSeconds] = useState(0);
	const [isSigningIn, setIsSigningIn] = useState(false);
	const router = useRouter();

	const { trigger: requestOtp, isMutating: isRequesting } =
		usePostApiRegisterRequestOtp();
	const { trigger: verifyOtp, isMutating: isVerifying } =
		usePostApiRegisterVerifyOtp();
	const { trigger: resendOtp, isMutating: isResending } =
		usePostApiRegisterResendOtp();

	const {
		register,
		handleSubmit,
		formState: { errors },
	} = useForm<RegisterValues>({
		resolver: zodResolver(registerSchema),
	});

	useEffect(() => {
		if (resendSeconds <= 0) return;
		const id = window.setTimeout(
			() => setResendSeconds((s) => Math.max(0, s - 1)),
			1000,
		);
		return () => window.clearTimeout(id);
	}, [resendSeconds]);

	async function onSubmit(values: RegisterValues) {
		setApiError(null);
		try {
			const result = await requestOtp({
				email: values.email,
				password: values.password,
			});
			setPendingEmail(result.email);
			setPendingPassword(values.password);
			setOtp("");
			setStep("otp");
			setResendSeconds(RESEND_COOLDOWN_SECONDS);
			toast.success("Verification code sent to your email");
		} catch (error) {
			setApiError(
				getErrorMessage(
					error,
					"Could not send verification code. Please try again.",
				),
			);
		}
	}

	async function onVerifyOtp() {
		if (otp.length !== 6) {
			setApiError("Enter the 6-digit code from your email.");
			return;
		}
		setApiError(null);
		try {
			await verifyOtp({ email: pendingEmail, otp });
			setIsSigningIn(true);
			const { error } = await authClient.signIn.email({
				email: pendingEmail,
				password: pendingPassword,
			});
			setPendingPassword("");
			if (error) {
				toast.success("Account created. Please sign in.");
				router.push("/login");
				return;
			}
			toast.success("Account created successfully!");
			router.push("/dashboard");
			router.refresh();
		} catch (error) {
			setApiError(
				getErrorMessage(error, "Verification failed. Please try again."),
			);
		} finally {
			setIsSigningIn(false);
		}
	}

	async function onResendOtp() {
		if (resendSeconds > 0 || isResending) return;
		setApiError(null);
		try {
			await resendOtp({ email: pendingEmail });
			setResendSeconds(RESEND_COOLDOWN_SECONDS);
			toast.success("A new code has been sent");
		} catch (error) {
			setApiError(
				getErrorMessage(error, "Could not resend code. Please try again."),
			);
		}
	}

	return (
		<div className="flex min-h-screen bg-gradient-hero">
			<div className="hidden lg:flex flex-1 justify-center items-center p-12 bg-gradient-primary">
				<div className="max-w-md text-primary-foreground text-center">
					<div className="flex justify-center items-center w-24 h-24 mx-auto mb-8 rounded-3xl bg-primary-foreground/20">
						<Image
							src="/logo.png"
							alt="Riaya"
							width={64}
							height={64}
							className="w-16 h-16"
						/>
					</div>
					<h2 className="mb-4 font-bold text-3xl">Join Riaya Today</h2>
					<p className="text-primary-foreground/80 text-lg">
						Create your account and start managing your medical practice
						digitally.
					</p>
				</div>
			</div>

			<div className="flex flex-1 justify-center items-center p-8">
				<div className="w-full max-w-md animate-fade-in-up">
					<Link href="/" className="inline-flex items-center gap-2 mb-8">
						<Image src="/logo.png" alt="Riaya" width={40} height={40} />
						<span className="font-bold text-gradient text-2xl">رعاية</span>
					</Link>

					<div className="mb-8">
						<h1 className="mb-2 font-bold text-foreground text-3xl">
							{step === "form" ? "Create your account" : "Verify your email"}
						</h1>
						<p className="text-muted-foreground">
							{step === "form"
								? "Get started with Riaya in just a few steps."
								: `We sent a 6-digit code to ${pendingEmail}.`}
						</p>
					</div>

					{apiError && (
						<div className="mb-4 p-3 border border-destructive/30 rounded-lg bg-destructive/10 text-destructive text-sm">
							{apiError}
						</div>
					)}

					{step === "form" ? (
						<form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
							<div className="space-y-2">
								<Label htmlFor="email">Email address</Label>
								<div className="relative">
									<Mail className="top-1/2 left-3 absolute w-5 h-5 text-muted-foreground -translate-y-1/2" />
									<Input
										id="email"
										type="email"
										placeholder="doctor@example.com"
										className="h-12 pl-10"
										{...register("email")}
									/>
								</div>
								{errors.email && (
									<p className="text-destructive text-sm">
										{errors.email.message}
									</p>
								)}
							</div>

							<div className="space-y-2">
								<Label htmlFor="password">Password</Label>
								<div className="relative">
									<Lock className="top-1/2 left-3 absolute w-5 h-5 text-muted-foreground -translate-y-1/2" />
									<Input
										id="password"
										type={showPassword ? "text" : "password"}
										placeholder="Create a password"
										className="h-12 pr-10 pl-10"
										{...register("password")}
									/>
									<button
										type="button"
										onClick={() => setShowPassword(!showPassword)}
										className="top-1/2 right-3 absolute text-muted-foreground hover:text-foreground -translate-y-1/2"
									>
										{showPassword ? (
											<EyeOff className="w-5 h-5" />
										) : (
											<Eye className="w-5 h-5" />
										)}
									</button>
								</div>
								{errors.password && (
									<p className="text-destructive text-sm">
										{errors.password.message}
									</p>
								)}
							</div>

							<div className="space-y-2">
								<Label htmlFor="confirmPassword">Confirm password</Label>
								<div className="relative">
									<Lock className="top-1/2 left-3 absolute w-5 h-5 text-muted-foreground -translate-y-1/2" />
									<Input
										id="confirmPassword"
										type="password"
										placeholder="Confirm your password"
										className="h-12 pl-10"
										{...register("confirmPassword")}
									/>
								</div>
								{errors.confirmPassword && (
									<p className="text-destructive text-sm">
										{errors.confirmPassword.message}
									</p>
								)}
							</div>

							<Button
								type="submit"
								size="lg"
								className="w-full"
								disabled={isRequesting}
							>
								{isRequesting ? "Sending code..." : "Continue"}
								{!isRequesting && <ArrowRight className="w-5 h-5" />}
							</Button>
						</form>
					) : (
						<div className="space-y-5">
							<div className="space-y-3">
								<Label htmlFor="otp">Verification code</Label>
								<InputOTP
									id="otp"
									maxLength={6}
									value={otp}
									onChange={setOtp}
									containerClassName="justify-center"
								>
									<InputOTPGroup>
										<InputOTPSlot index={0} className="size-11" />
										<InputOTPSlot index={1} className="size-11" />
										<InputOTPSlot index={2} className="size-11" />
										<InputOTPSlot index={3} className="size-11" />
										<InputOTPSlot index={4} className="size-11" />
										<InputOTPSlot index={5} className="size-11" />
									</InputOTPGroup>
								</InputOTP>
							</div>

							<Button
								type="button"
								size="lg"
								className="w-full"
								disabled={isVerifying || isSigningIn || otp.length !== 6}
								onClick={onVerifyOtp}
							>
								{isVerifying || isSigningIn
									? "Creating account..."
									: "Verify and create account"}
								{!(isVerifying || isSigningIn) && (
									<ArrowRight className="w-5 h-5" />
								)}
							</Button>

							<div className="flex flex-col items-center gap-2 text-sm">
								<button
									type="button"
									className="text-primary hover:underline disabled:opacity-50 disabled:no-underline"
									disabled={resendSeconds > 0 || isResending}
									onClick={onResendOtp}
								>
									{resendSeconds > 0
										? `Resend code in ${resendSeconds}s`
										: isResending
											? "Sending..."
											: "Resend code"}
								</button>
								<button
									type="button"
									className="text-muted-foreground hover:text-foreground"
									onClick={() => {
										setStep("form");
										setApiError(null);
										setOtp("");
										setPendingPassword("");
									}}
								>
									Use a different email
								</button>
							</div>
						</div>
					)}

					{step === "form" && (
						<p className="mt-8 text-muted-foreground text-sm text-center">
							Already have an account?{" "}
							<Link
								href="/login"
								className="font-medium text-primary hover:underline"
							>
								Sign in
							</Link>
						</p>
					)}
				</div>
			</div>
		</div>
	);
}
