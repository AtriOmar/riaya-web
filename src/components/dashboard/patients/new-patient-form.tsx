"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { createPatient } from "@/services";

const schema = z.object({
	cin: z.string().min(1, "CIN is required"),
	firstName: z.string().min(1, "First name is required"),
	lastName: z.string().min(1, "Last name is required"),
	dateOfBirth: z.string().min(1, "Date of birth is required"),
	gender: z.string().min(1, "Gender is required"),
	address: z.string(),
	phoneNumber: z.string(),
});

type FormValues = z.infer<typeof schema>;

export default function NewPatientForm() {
	const router = useRouter();

	const {
		register,
		handleSubmit,
		setValue,
		watch,
		formState: { errors, isSubmitting },
	} = useForm<FormValues>({
		resolver: zodResolver(schema),
		defaultValues: {
			cin: "",
			firstName: "",
			lastName: "",
			dateOfBirth: "",
			gender: "",
			address: "",
			phoneNumber: "",
		},
	});

	const gender = watch("gender");

	async function onSubmit(values: FormValues) {
		values.dateOfBirth = new Date(values.dateOfBirth).toISOString();

		try {
			const patient = await createPatient(values);
			toast.success("Patient created successfully");
			router.push(`/dashboard/patients/${patient.id}`);
		} catch {
			toast.error("Failed to create patient");
		}
	}

	return (
		<form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-w-xl">
			<div>
				<Label htmlFor="cin">
					CIN <span className="text-destructive">*</span>
				</Label>
				<Input
					id="cin"
					className="mt-0.5"
					placeholder="e.g. AB123456"
					{...register("cin")}
				/>
				{errors.cin && (
					<p className="mt-1 text-destructive text-sm">{errors.cin.message}</p>
				)}
			</div>
			<div className="gap-4 grid grid-cols-2">
				<div>
					<Label htmlFor="firstName">
						First Name <span className="text-destructive">*</span>
					</Label>
					<Input
						id="firstName"
						className="mt-0.5"
						placeholder="First name"
						{...register("firstName")}
					/>
					{errors.firstName && (
						<p className="mt-1 text-destructive text-sm">
							{errors.firstName.message}
						</p>
					)}
				</div>
				<div>
					<Label htmlFor="lastName">
						Last Name <span className="text-destructive">*</span>
					</Label>
					<Input
						id="lastName"
						className="mt-0.5"
						placeholder="Last name"
						{...register("lastName")}
					/>
					{errors.lastName && (
						<p className="mt-1 text-destructive text-sm">
							{errors.lastName.message}
						</p>
					)}
				</div>
			</div>
			<div>
				<Label htmlFor="dateOfBirth">
					Date of Birth <span className="text-destructive">*</span>
				</Label>
				<Input
					id="dateOfBirth"
					className="mt-0.5"
					type="date"
					{...register("dateOfBirth")}
				/>
				{errors.dateOfBirth && (
					<p className="mt-1 text-destructive text-sm">
						{errors.dateOfBirth.message}
					</p>
				)}
			</div>
			<div>
				<Label>
					Gender <span className="text-destructive">*</span>
				</Label>
				<div className="mt-0.5 flex gap-2">
					{(["male", "female"] as const).map((g) => (
						<button
							key={g}
							type="button"
							className={cn(
								"flex-1 py-2 px-4 rounded-md border text-sm font-medium transition-colors",
								gender === g
									? "bg-primary text-primary-foreground border-primary"
									: "bg-background text-foreground border-input hover:bg-accent",
							)}
							onClick={() => setValue("gender", g, { shouldValidate: true })}
						>
							{g.charAt(0).toUpperCase() + g.slice(1)}
						</button>
					))}
				</div>
				{errors.gender && (
					<p className="mt-1 text-destructive text-sm">
						{errors.gender.message}
					</p>
				)}
			</div>
			<div>
				<Label htmlFor="phoneNumber">Phone Number</Label>
				<Input
					id="phoneNumber"
					className="mt-0.5"
					placeholder="+212 6 12 34 56 78"
					{...register("phoneNumber")}
				/>
			</div>
			<div>
				<Label htmlFor="address">Address</Label>
				<Input
					id="address"
					className="mt-0.5"
					placeholder="Street, city, postal code"
					{...register("address")}
				/>
			</div>
			<Button type="submit" className="w-full" disabled={isSubmitting}>
				{isSubmitting ? "Creating..." : "Create Patient"}
			</Button>
		</form>
	);
}
