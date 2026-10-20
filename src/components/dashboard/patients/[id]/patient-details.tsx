"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil } from "lucide-react";
import { useEffect, useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { getErrorMessage } from "@/lib/error-handling";
import { formatPhoneDisplay, normalizePhoneForStorage } from "@/lib/phone";
import type { GetApiPatientsId200 } from "@/services/generated/api.schemas";
import { usePatchApiPatientsId } from "@/services/generated/patients/patients";
import {
	PatientContactFields,
	type PatientFieldsValues,
	PatientPersonalFields,
	patientFieldsSchema,
} from "../patient-form-fields";

type FormValues = PatientFieldsValues;

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
	const { trigger: updatePatient } = usePatchApiPatientsId(
		patient.id.toString(),
	);

	const defaults = (): FormValues => ({
		cin: patient.cin ?? "",
		firstName: patient.firstName ?? "",
		lastName: patient.lastName ?? "",
		dateOfBirth: dobInputValue(patient.dateOfBirth),
		gender: genderForForm(patient.gender),
		address: patient.address ?? "",
		phoneNumber: patient.phoneNumber ?? "",
	});

	const form = useForm<FormValues>({
		resolver: zodResolver(patientFieldsSchema),
		defaultValues: defaults(),
	});
	const { reset } = form;

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
				cin: values.cin.toUpperCase(),
				phoneNumber: phone,
				dateOfBirth: new Date(values.dateOfBirth).toISOString(),
			});
			toast.success("Patient updated");
			setEditing(false);
			onUpdated();
		} catch (err) {
			toast.error(getErrorMessage(err));
		}
	}

	function cancelEdit() {
		reset(defaults());
		setEditing(false);
	}

	if (editing) {
		return (
			<FormProvider {...form}>
				<form
					onSubmit={form.handleSubmit(onSubmit)}
					noValidate
					className="flex flex-col gap-5 bg-card p-4 md:p-5 border rounded-xl max-w-2xl"
				>
					<div className="flex flex-wrap justify-between items-center gap-2">
						<h2 className="font-semibold text-lg">Edit patient</h2>
						<div className="flex gap-2">
							<Button type="button" variant="outline" onClick={cancelEdit}>
								Cancel
							</Button>
							<Button type="submit" disabled={form.formState.isSubmitting}>
								{form.formState.isSubmitting ? "Saving…" : "Save"}
							</Button>
						</div>
					</div>
					<PatientPersonalFields />
					<Separator />
					<PatientContactFields />
				</form>
			</FormProvider>
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
