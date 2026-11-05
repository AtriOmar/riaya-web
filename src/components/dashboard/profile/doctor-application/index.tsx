"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Check } from "lucide-react";
import { type FormEvent, useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useFormDraft } from "@/hooks/use-form-draft";
import { uploadToR2 } from "@/lib/upload";
import { cn } from "@/lib/utils";
import type {
	GetApiCities200Item,
	GetApiSpecialities200Item,
} from "@/services/generated/api.schemas";
import { usePostApiDoctorApplications } from "@/services/generated/doctors/doctors";
import BusinessInfo from "./business-info";
import PersonalInfo from "./personal-info";
import ProfessionalInfo from "./professional-info";
import { type FormValues, firstIncompleteStep, schema, steps } from "./schema";

type Props = {
	specialities: GetApiSpecialities200Item[];
	cities: GetApiCities200Item[];
	onApplicationSubmitted: () => void;
};

export default function DoctorApplicationForm({
	specialities,
	cities,
	onApplicationSubmitted,
}: Props) {
	const [step, setStep] = useState(0);
	const { trigger: createDoctorApplication, isMutating: sending } =
		usePostApiDoctorApplications();

	const methods = useForm<FormValues>({
		resolver: zodResolver(schema),
		defaultValues: {
			firstName: "",
			lastName: "",
			cin: "",
			specialityId: "",
			medicalCouncilNumber: "",
			cabinetName: "",
			tin: "",
			cabinetCityId: "",
			cabinetAddress: "",
		},
	});

	const { handleSubmit, watch, reset, trigger } = methods;

	const { isRestored, clearDraft } = useFormDraft({
		draftKey: "doctor_application_draft",
		watch,
		reset,
		onRestored: (values) => {
			if (values) setStep(firstIncompleteStep(values));
		},
	});

	const isLastStep = step === steps.length - 1;

	const goNext = async () => {
		if (await trigger(steps[step].fields, { shouldFocus: true })) {
			setStep((s) => s + 1);
		}
	};

	const onSubmit = async (data: FormValues) => {
		try {
			const [cinRectoUrl, cinVersoUrl, certUrl] = await Promise.all([
				uploadToR2(data.cinRecto, "doctor-applications"),
				uploadToR2(data.cinVerso, "doctor-applications"),
				uploadToR2(data.medicalCouncilCertificate, "doctor-applications"),
			]);

			await createDoctorApplication({
				firstName: data.firstName,
				lastName: data.lastName,
				cin: data.cin,
				cabinetName: data.cabinetName,
				cabinetAddress: data.cabinetAddress,
				cabinetLatitude: data.cabinetLatitude,
				cabinetLongitude: data.cabinetLongitude,
				tin: data.tin,
				medicalCouncilNumber: data.medicalCouncilNumber,
				cabinetCityId: Number.parseInt(data.cabinetCityId, 10),
				specialityId: Number.parseInt(data.specialityId, 10),
				medicalCouncilCertificate: certUrl,
				cinRecto: cinRectoUrl,
				cinVerso: cinVersoUrl,
			});

			await clearDraft();

			toast.success("Application submitted successfully");
			onApplicationSubmitted();
		} catch {
			toast.error("Failed to submit application");
		}
	};

	// Enter in a field moves to the next step instead of submitting the whole form
	const onFormSubmit = (e: FormEvent<HTMLFormElement>) => {
		if (isLastStep) return handleSubmit(onSubmit)(e);
		e.preventDefault();
		goNext();
	};

	if (!isRestored) {
		return <Skeleton className="mt-6 w-full h-96" />;
	}

	return (
		<FormProvider {...methods}>
			<form onSubmit={onFormSubmit} className="space-y-4 mt-4">
				<StepIndicator current={step} onSelect={setStep} />

				{step === 0 && <PersonalInfo />}
				{step === 1 && <ProfessionalInfo specialities={specialities} />}
				{step === 2 && <BusinessInfo cities={cities} />}

				<div className="flex gap-3 mt-6">
					{step > 0 && (
						<Button
							type="button"
							variant="outline"
							onClick={() => setStep((s) => s - 1)}
							disabled={sending}
						>
							Back
						</Button>
					)}
					<Button type="submit" className="flex-1" disabled={sending}>
						{isLastStep
							? sending
								? "Submitting..."
								: "Apply For Verification"
							: "Continue"}
					</Button>
				</div>
			</form>
		</FormProvider>
	);
}

function StepIndicator({
	current,
	onSelect,
}: {
	current: number;
	onSelect: (step: number) => void;
}) {
	return (
		<ol className="flex justify-center items-center gap-2 mt-5">
			{steps.map((s, i) => {
				const done = i < current;
				const active = i === current;
				return (
					<li key={s.title} className="flex items-center gap-2">
						<button
							type="button"
							// Only completed steps are reachable directly; forward goes through Continue
							disabled={!done}
							onClick={() => onSelect(i)}
							className="flex items-center gap-2 disabled:cursor-default"
							aria-current={active ? "step" : undefined}
						>
							<span
								className={cn(
									"flex justify-center items-center rounded-full size-7 font-medium text-sm shrink-0",
									done && "bg-primary text-primary-foreground",
									active && "ring-2 ring-primary text-primary",
									!done && !active && "bg-muted text-muted-foreground",
								)}
							>
								{done ? <Check className="size-4" /> : i + 1}
							</span>
							<span
								className={cn(
									"hidden sm:inline font-medium text-sm",
									active ? "text-foreground" : "text-muted-foreground",
								)}
							>
								{s.title}
							</span>
						</button>
						{i < steps.length - 1 && (
							<div
								className={cn(
									"w-8 sm:w-12 h-px",
									done ? "bg-primary" : "bg-border",
								)}
							/>
						)}
					</li>
				);
			})}
		</ol>
	);
}
