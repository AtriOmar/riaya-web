"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil } from "lucide-react";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneNumberInput } from "@/components/ui/phone-input";
import {
	formatPhoneDisplay,
	isValidPhoneNumber,
	normalizePhoneForStorage,
} from "@/lib/phone";
import { cn } from "@/lib/utils";
import type { GetApiPatientsId200 } from "@/services/generated/api.schemas";
import { usePatchApiPatientsId } from "@/services/generated/patients/patients";

const schema = z.object({
	cin: z.string().min(1, "CIN is required"),
	firstName: z.string().min(1, "First name is required"),
	lastName: z.string().min(1, "Last name is required"),
	dateOfBirth: z.string().min(1, "Date of birth is required"),
	gender: z.string().min(1, "Gender is required"),
	address: z.string(),
	phoneNumber: z
		.string()
		.min(1, "Phone number is required")
		.refine((v) => isValidPhoneNumber(v), "Enter a valid phone number"),
});

type FormValues = z.infer<typeof schema>;

function genderForForm(stored: string | null | undefined): string {
	if (!stored) return "";
	const s = stored.toLowerCase();
	if (s === "m" || s === "male") return "male";
	if (s === "f" || s === "female") return "female";
	return s;
}

function dobInputValue(d: Date | string | null | undefined): string {
	if (!d) return "";
	const date = typeof d === "string" ? new Date(d) : d;
	if (Number.isNaN(date.getTime())) return "";
	return date.toISOString().slice(0, 10);
}

function formatGenderDisplay(g: string | null | undefined) {
	if (!g) return "—";
	const s = g.toLowerCase();
	if (s === "male" || s === "m") return "Male";
	if (s === "female" || s === "f") return "Female";
	return g.charAt(0).toUpperCase() + g.slice(1);
}

export function PatientDetails({
	patient,
	onUpdated,
}: {
	patient: GetApiPatientsId200;
	onUpdated: () => void;
}) {
	const [editing, setEditing] = useState(false);
	const { trigger: updatePatient, isMutating: isSubmittingAPI } =
		usePatchApiPatientsId(patient.id.toString());

	const defaults = (): FormValues => ({
		cin: patient.cin ?? "",
		firstName: patient.firstName ?? "",
		lastName: patient.lastName ?? "",
		dateOfBirth: dobInputValue(patient.dateOfBirth),
		gender: genderForForm(patient.gender),
		address: patient.address ?? "",
		phoneNumber: patient.phoneNumber ?? "",
	});

	const {
		register,
		handleSubmit,
		setValue,
		watch,
		reset,
		control,
		formState: { errors, isSubmitting },
	} = useForm<FormValues>({
		resolver: zodResolver(schema),
		defaultValues: defaults(),
	});

	const gender = watch("gender");

	useEffect(() => {
		reset(defaults());
	}, [patient]);

	async function onSubmit(values: FormValues) {
		const phone = normalizePhoneForStorage(values.phoneNumber);
		if (!phone) {
			toast.error("Enter a valid phone number");
			return;
		}
		try {
			await updatePatient({
				...values,
				phoneNumber: phone,
				dateOfBirth: new Date(values.dateOfBirth).toISOString(),
			});
			toast.success("Patient updated");
			setEditing(false);
			onUpdated();
		} catch {
			toast.error("Could not save changes");
		}
	}

	function cancelEdit() {
		reset(defaults());
		setEditing(false);
	}

	if (editing) {
		return (
			<form
				onSubmit={handleSubmit(onSubmit)}
				className="max-w-xl space-y-4 rounded-xl border bg-card p-4"
			>
				<div className="flex flex-wrap items-center justify-between gap-2">
					<h2 className="font-semibold text-lg">Edit patient</h2>
					<div className="flex gap-2">
						<Button type="button" variant="outline" onClick={cancelEdit}>
							Cancel
						</Button>
						<Button type="submit" disabled={isSubmitting || isSubmittingAPI}>
							{isSubmitting || isSubmittingAPI ? "Saving…" : "Save"}
						</Button>
					</div>
				</div>
				<div>
					<Label htmlFor="edit-cin">
						CIN <span className="text-destructive">*</span>
					</Label>
					<Input id="edit-cin" className="mt-0.5" {...register("cin")} />
					{errors.cin && (
						<p className="mt-1 text-destructive text-sm">
							{errors.cin.message}
						</p>
					)}
				</div>
				<div className="gap-4 grid grid-cols-2">
					<div>
						<Label htmlFor="edit-firstName">
							First name <span className="text-destructive">*</span>
						</Label>
						<Input
							id="edit-firstName"
							className="mt-0.5"
							{...register("firstName")}
						/>
						{errors.firstName && (
							<p className="mt-1 text-destructive text-sm">
								{errors.firstName.message}
							</p>
						)}
					</div>
					<div>
						<Label htmlFor="edit-lastName">
							Last name <span className="text-destructive">*</span>
						</Label>
						<Input
							id="edit-lastName"
							className="mt-0.5"
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
					<Label htmlFor="edit-dob">
						Date of birth <span className="text-destructive">*</span>
					</Label>
					<Input
						id="edit-dob"
						type="date"
						className="mt-0.5"
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
									"flex-1 rounded-md border py-2 font-medium text-sm transition-colors",
									gender === g
										? "border-primary bg-primary text-primary-foreground"
										: "border-input bg-background text-foreground hover:bg-accent",
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
					<Label htmlFor="edit-phone">Phone</Label>
					<Controller
						name="phoneNumber"
						control={control}
						render={({ field }) => (
							<PhoneNumberInput
								id="edit-phone"
								className="mt-0.5"
								value={field.value}
								onChange={field.onChange}
								onBlur={field.onBlur}
								aria-invalid={!!errors.phoneNumber}
							/>
						)}
					/>
					{errors.phoneNumber && (
						<p className="mt-1 text-destructive text-sm">
							{errors.phoneNumber.message}
						</p>
					)}
				</div>
				<div>
					<Label htmlFor="edit-address">Address</Label>
					<Input
						id="edit-address"
						className="mt-0.5"
						{...register("address")}
					/>
				</div>
			</form>
		);
	}

	return (
		<div className="relative max-w-xl rounded-xl border bg-card p-4 pr-12">
			<Button
				type="button"
				variant="ghost"
				size="icon"
				className="absolute top-2 right-2"
				aria-label="Edit patient"
				onClick={() => setEditing(true)}
			>
				<Pencil className="size-4" />
			</Button>
			<div className="gap-4 grid grid-cols-1 sm:grid-cols-3">
				<div>
					<p className="text-muted-foreground text-sm">CIN</p>
					<p className="font-medium">{patient.cin ?? "—"}</p>
				</div>
				<div>
					<p className="text-muted-foreground text-sm">Full name</p>
					<p className="font-medium">
						{patient.firstName} {patient.lastName}
					</p>
				</div>
				<div>
					<p className="text-muted-foreground text-sm">Date of birth</p>
					<p className="font-medium">
						{patient.dateOfBirth
							? new Date(patient.dateOfBirth).toLocaleDateString("en-GB")
							: "—"}
					</p>
				</div>
				<div>
					<p className="text-muted-foreground text-sm">Gender</p>
					<p className="font-medium">{formatGenderDisplay(patient.gender)}</p>
				</div>
				<div>
					<p className="text-muted-foreground text-sm">Phone</p>
					<p className="font-medium tabular-nums">
						{formatPhoneDisplay(patient.phoneNumber)}
					</p>
				</div>
				<div className="sm:col-span-2">
					<p className="text-muted-foreground text-sm">Address</p>
					<p className="font-medium">{patient.address ?? "—"}</p>
				</div>
			</div>
		</div>
	);
}
