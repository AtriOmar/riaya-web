"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { updatePatient } from "@/services";
import type { PatientWithMedicalFiles } from "@/services/types";

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
	patient: PatientWithMedicalFiles;
	onUpdated: () => void;
}) {
	const [editing, setEditing] = useState(false);

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
		try {
			await updatePatient(patient.id, {
				...values,
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
						<Button type="submit" disabled={isSubmitting}>
							{isSubmitting ? "Saving…" : "Save"}
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
					<Input
						id="edit-phone"
						className="mt-0.5"
						{...register("phoneNumber")}
					/>
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
		<div className="space-y-3">
			<div className="flex max-w-xl items-start justify-between gap-4">
				<h2 className="font-semibold text-lg">Patient details</h2>
				<Button
					type="button"
					variant="outline"
					size="sm"
					onClick={() => setEditing(true)}
				>
					<Pencil className="mr-1.5 size-4" />
					Edit
				</Button>
			</div>
			<div className="gap-4 grid max-w-xl grid-cols-1 rounded-xl border bg-card p-4 sm:grid-cols-3">
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
					<p className="font-medium">{patient.phoneNumber ?? "—"}</p>
				</div>
				<div className="sm:col-span-2">
					<p className="text-muted-foreground text-sm">Address</p>
					<p className="font-medium">{patient.address ?? "—"}</p>
				</div>
			</div>
		</div>
	);
}
