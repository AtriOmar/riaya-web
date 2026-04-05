"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
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
				<Input id="cin" {...register("cin")} />
				{errors.cin && (
					<p className="mt-1 text-destructive text-sm">{errors.cin.message}</p>
				)}
			</div>
			<div className="gap-4 grid grid-cols-2">
				<div>
					<Label htmlFor="firstName">
						First Name <span className="text-destructive">*</span>
					</Label>
					<Input id="firstName" {...register("firstName")} />
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
					<Input id="lastName" {...register("lastName")} />
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
				<Input id="dateOfBirth" type="date" {...register("dateOfBirth")} />
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
				<Select
					value={gender}
					onValueChange={(v) => setValue("gender", v, { shouldValidate: true })}
				>
					<SelectTrigger>
						<SelectValue placeholder="Select gender" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="male">Male</SelectItem>
						<SelectItem value="female">Female</SelectItem>
					</SelectContent>
				</Select>
				{errors.gender && (
					<p className="mt-1 text-destructive text-sm">
						{errors.gender.message}
					</p>
				)}
			</div>
			<div>
				<Label htmlFor="phoneNumber">Phone Number</Label>
				<Input id="phoneNumber" {...register("phoneNumber")} />
			</div>
			<div>
				<Label htmlFor="address">Address</Label>
				<Input id="address" {...register("address")} />
			</div>
			<Button type="submit" className="w-full" disabled={isSubmitting}>
				{isSubmitting ? "Creating..." : "Create Patient"}
			</Button>
		</form>
	);
}
