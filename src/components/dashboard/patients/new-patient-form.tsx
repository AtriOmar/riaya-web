"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Phone, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactNode, useId } from "react";
import { Controller, FormProvider, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { getErrorMessage } from "@/lib/error-handling";
import { normalizePhoneForStorage } from "@/lib/phone";
import { usePostApiPatients } from "@/services/generated/patients/patients";
import {
	ChoiceChips,
	Field,
	PatientContactFields,
	PatientPersonalFields,
	patientFieldsSchema,
} from "./patient-form-fields";

/** How the patient relates to the owner of the phone number. */
const PHONE_OWNER_RELATIONSHIPS = [
	{ value: "child", label: "Child" },
	{ value: "parent", label: "Parent" },
	{ value: "spouse", label: "Spouse" },
	{ value: "sibling", label: "Sibling" },
	{ value: "other", label: "Other" },
] as const;

const schema = patientFieldsSchema
	.extend({
		/** The number belongs to someone else (e.g. a child's parent). */
		phoneIsSomeoneElses: z.boolean(),
		phoneOwnerRelationship: z
			.enum(["child", "parent", "spouse", "sibling", "other"])
			.optional(),
	})
	.refine((v) => !v.phoneIsSomeoneElses || v.phoneOwnerRelationship, {
		path: ["phoneOwnerRelationship"],
		message: "Choose how the patient is related to the owner",
	});

type FormValues = z.infer<typeof schema>;

function Section({
	icon,
	title,
	description,
	children,
}: {
	icon: ReactNode;
	title: string;
	description: string;
	children: ReactNode;
}) {
	return (
		<section className="gap-5 grid md:grid-cols-[13rem_1fr] md:gap-8">
			<div className="flex gap-3 md:flex-col md:gap-2">
				<span className="flex justify-center items-center bg-primary/10 rounded-lg size-8 text-primary shrink-0 [&_svg]:size-4">
					{icon}
				</span>
				<div>
					<h2 className="font-semibold text-sm">{title}</h2>
					<p className="mt-0.5 text-muted-foreground text-xs">{description}</p>
				</div>
			</div>
			{children}
		</section>
	);
}

export default function NewPatientForm() {
	const router = useRouter();
	const { trigger: createPatient } = usePostApiPatients();

	const form = useForm<FormValues>({
		resolver: zodResolver(schema),
		defaultValues: {
			firstName: "",
			lastName: "",
			dateOfBirth: "",
			gender: "",
			cin: "",
			phoneNumber: "",
			address: "",
			phoneIsSomeoneElses: false,
		},
	});
	const {
		control,
		watch,
		formState: { errors, isSubmitting },
	} = form;
	const phoneIsSomeoneElses = watch("phoneIsSomeoneElses");
	const ownerCheckboxId = useId();

	async function onSubmit({ phoneIsSomeoneElses, ...values }: FormValues) {
		const phone = normalizePhoneForStorage(values.phoneNumber);
		if (!phone) {
			toast.error("Enter a valid phone number");
			return;
		}

		try {
			const patient = await createPatient({
				...values,
				cin: values.cin.toUpperCase(),
				phoneNumber: phone,
				phoneOwnerRelationship: phoneIsSomeoneElses
					? values.phoneOwnerRelationship
					: undefined,
				dateOfBirth: new Date(values.dateOfBirth).toISOString(),
			});
			toast.success("Patient created");
			router.push(`/dashboard/patients/${patient.id}`);
		} catch (err) {
			toast.error(getErrorMessage(err));
		}
	}

	const phoneOwner = (
		<div className="flex flex-col gap-3">
			<Controller
				name="phoneIsSomeoneElses"
				control={control}
				render={({ field }) => (
					<label
						htmlFor={ownerCheckboxId}
						className="flex items-start gap-2.5 w-fit cursor-pointer"
					>
						<Checkbox
							id={ownerCheckboxId}
							checked={field.value}
							onCheckedChange={(v) => field.onChange(v === true)}
							className="mt-0.5"
						/>
						<span className="text-sm">
							This number belongs to someone else
							<span className="block text-muted-foreground text-xs">
								For example, a child using a parent&apos;s phone.
							</span>
						</span>
					</label>
				)}
			/>
			{phoneIsSomeoneElses && (
				<Field
					label="The patient is the owner's…"
					error={errors.phoneOwnerRelationship?.message}
					className="bg-muted/50 ml-6.5 p-3 border rounded-lg"
				>
					<Controller
						name="phoneOwnerRelationship"
						control={control}
						render={({ field }) => (
							<ChoiceChips
								label="Relationship to the phone owner"
								options={PHONE_OWNER_RELATIONSHIPS}
								value={field.value}
								onChange={field.onChange}
								invalid={!!errors.phoneOwnerRelationship}
							/>
						)}
					/>
				</Field>
			)}
		</div>
	);

	return (
		<FormProvider {...form}>
			<form
				onSubmit={form.handleSubmit(onSubmit)}
				noValidate
				className="bg-card shadow-xs border rounded-xl max-w-4xl"
			>
				<div className="flex flex-col gap-8 p-5 md:p-8">
					<Section
						icon={<UserRound />}
						title="Personal details"
						description="As they will appear on the patient file."
					>
						<PatientPersonalFields />
					</Section>
					<Separator />
					<Section
						icon={<Phone />}
						title="Contact"
						description="Where the patient or their family can be reached."
					>
						<PatientContactFields afterPhone={phoneOwner} />
					</Section>
				</div>
				<div className="flex sm:flex-row flex-col-reverse justify-end gap-2 bg-muted/30 px-5 md:px-8 py-4 border-t rounded-b-xl">
					<Button asChild variant="outline">
						<Link href="/dashboard/patients">Cancel</Link>
					</Button>
					<Button type="submit" disabled={isSubmitting}>
						{isSubmitting ? "Creating…" : "Create patient"}
					</Button>
				</div>
			</form>
		</FormProvider>
	);
}
