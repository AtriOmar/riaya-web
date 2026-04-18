"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Eye, EyeOff, Lock, Mail, User } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";

const registerSchema = z
	.object({
		name: z.string().min(1, "Name is required"),
		username: z.string().min(3, "Username must be at least 3 characters"),
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

export default function RegisterForm() {
	const [showPassword, setShowPassword] = useState(false);
	const [apiError, setApiError] = useState<string | null>(null);
	const router = useRouter();

	const {
		register,
		handleSubmit,
		formState: { errors, isSubmitting },
	} = useForm<RegisterValues>({
		resolver: zodResolver(registerSchema),
	});

	async function onSubmit(values: RegisterValues) {
		setApiError(null);
		const { error } = await authClient.signUp.email({
			name: values.name,
			email: values.email,
			password: values.password,
			// better-auth additionalFields are accepted at runtime
			username: values.username,
		} as Parameters<typeof authClient.signUp.email>[0]);

		if (error) {
			if (error.message?.toLowerCase().includes("already")) {
				setApiError("An account with this email already exists.");
			} else {
				setApiError(error.message ?? "Registration failed. Please try again.");
			}
			return;
		}

		toast.success("Account created successfully!");
		router.push("/dashboard");
		router.refresh();
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
							Create your account
						</h1>
						<p className="text-muted-foreground">
							Get started with Riaya in just a few steps.
						</p>
					</div>

					{apiError && (
						<div className="mb-4 p-3 border border-destructive/30 rounded-lg bg-destructive/10 text-destructive text-sm">
							{apiError}
						</div>
					)}

					<form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
						<div className="space-y-2">
							<Label htmlFor="name">Full name</Label>
							<div className="relative">
								<User className="top-1/2 left-3 absolute w-5 h-5 text-muted-foreground -translate-y-1/2" />
								<Input
									id="name"
									placeholder="Dr. John Doe"
									className="h-12 pl-10"
									{...register("name")}
								/>
							</div>
							{errors.name && (
								<p className="text-destructive text-sm">
									{errors.name.message}
								</p>
							)}
						</div>

						<div className="space-y-2">
							<Label htmlFor="username">Username</Label>
							<div className="relative">
								<User className="top-1/2 left-3 absolute w-5 h-5 text-muted-foreground -translate-y-1/2" />
								<Input
									id="username"
									placeholder="drjohn"
									className="h-12 pl-10"
									{...register("username")}
								/>
							</div>
							{errors.username && (
								<p className="text-destructive text-sm">
									{errors.username.message}
								</p>
							)}
						</div>

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
							disabled={isSubmitting}
						>
							{isSubmitting ? "Creating account..." : "Create account"}
							{!isSubmitting && <ArrowRight className="w-5 h-5" />}
						</Button>
					</form>

					<p className="mt-8 text-muted-foreground text-sm text-center">
						Already have an account?{" "}
						<Link
							href="/login"
							className="font-medium text-primary hover:underline"
						>
							Sign in
						</Link>
					</p>
				</div>
			</div>
		</div>
	);
}
