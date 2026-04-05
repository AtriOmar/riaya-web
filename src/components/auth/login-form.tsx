"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Eye, EyeOff, Lock, Mail } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";

const loginSchema = z.object({
	email: z.string().min(1, "Email is required").email("Invalid email address"),
	password: z.string().min(1, "Password is required"),
});

type LoginValues = z.infer<typeof loginSchema>;

export default function LoginForm() {
	const [showPassword, setShowPassword] = useState(false);
	const [apiError, setApiError] = useState<string | null>(null);
	const router = useRouter();

	const {
		register,
		handleSubmit,
		formState: { errors, isSubmitting },
	} = useForm<LoginValues>({
		resolver: zodResolver(loginSchema),
	});

	async function onSubmit(values: LoginValues) {
		setApiError(null);
		const { error } = await authClient.signIn.email({
			email: values.email,
			password: values.password,
		});

		if (error) {
			setApiError(error.message ?? "Invalid email or password.");
			return;
		}

		toast.success("Logged in successfully");
		router.push("/dashboard");
		router.refresh();
	}

	return (
		<div className="flex min-h-screen bg-gradient-hero">
			<div className="flex flex-1 justify-center items-center p-8">
				<div className="w-full max-w-md animate-fade-in-up">
					<Link href="/" className="inline-flex items-center gap-2 mb-8">
						<Image
							src="/logo.png"
							alt="Riaya"
							width={40}
							height={40}
							className="w-10 h-10"
						/>
						<span className="font-bold text-gradient text-2xl">رعاية</span>
					</Link>

					<div className="mb-8">
						<h1 className="mb-2 font-bold text-foreground text-3xl">
							Welcome back, Doctor
						</h1>
						<p className="text-muted-foreground">
							Sign in to your dashboard to manage appointments and patients.
						</p>
					</div>

					{apiError && (
						<div className="mb-4 p-3 border border-destructive/30 rounded-lg bg-destructive/10 text-destructive text-sm">
							{apiError}
						</div>
					)}

					<form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
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
							<div className="flex justify-between items-center">
								<Label htmlFor="password">Password</Label>
								<Link href="#" className="text-primary text-sm hover:underline">
									Forgot password?
								</Link>
							</div>
							<div className="relative">
								<Lock className="top-1/2 left-3 absolute w-5 h-5 text-muted-foreground -translate-y-1/2" />
								<Input
									id="password"
									type={showPassword ? "text" : "password"}
									placeholder="Enter your password"
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

						<div className="flex items-center gap-2">
							<Checkbox id="remember" />
							<Label
								htmlFor="remember"
								className="font-normal text-sm cursor-pointer"
							>
								Remember me for 30 days
							</Label>
						</div>

						<Button
							type="submit"
							size="lg"
							className="w-full bg-gradient-primary text-primary-foreground"
							disabled={isSubmitting}
						>
							{isSubmitting ? "Signing in..." : "Sign in to Dashboard"}
							{!isSubmitting && <ArrowRight className="w-5 h-5" />}
						</Button>
					</form>

					<p className="mt-8 text-muted-foreground text-center">
						New to Riaya?{" "}
						<Link
							href="/register"
							className="font-semibold text-primary hover:underline"
						>
							Register your practice
						</Link>
					</p>
				</div>
			</div>

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
					<h2 className="mb-4 font-bold text-3xl">
						Your Practice, Powered by AI
					</h2>
					<p className="text-primary-foreground/80 text-lg">
						Manage your schedule, accept AI-matched appointments, and grow your
						practice, all from one dashboard.
					</p>
				</div>
			</div>
		</div>
	);
}
