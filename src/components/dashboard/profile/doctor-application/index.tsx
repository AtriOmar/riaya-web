"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useFormDraft } from "@/hooks/use-form-draft";
import { uploadToR2 } from "@/lib/upload";
import type {
	GetApiCities200Item,
	GetApiSpecialities200Item,
} from "@/services/generated/api.schemas";
import { usePostApiDoctorApplications } from "@/services/generated/doctors/doctors";
import BusinessInfo from "./business-info";
import PersonalInfo from "./personal-info";
import ProfessionalInfo from "./professional-info";
import { type FormValues, schema } from "./schema";

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
	const [cinRecto, setCinRecto] = useState<File | null>(null);
	const [cinVerso, setCinVerso] = useState<File | null>(null);
	const [cinRectoError, setCinRectoError] = useState<string | null>(null);
	const [cinVersoError, setCinVersoError] = useState<string | null>(null);
	const [medicalCouncilCertificate, setMedicalCouncilCertificate] =
		useState<File | null>(null);
	const [medicalCouncilCertificateError, setMedicalCouncilCertificateError] =
		useState<string | null>(null);
	const { trigger: createDoctorApplication, isMutating: sending } =
		usePostApiDoctorApplications();

	const methods = useForm<FormValues>({
		resolver: zodResolver(schema),
		defaultValues: {
			firstName: "",
			lastName: "",
			cabinetName: "",
			cabinetCityId: "",
			specialityId: "",
			tin: "",
			medicalCouncilNumber: "",
		},
	});

	const { handleSubmit, watch, reset } = methods;

	const { clearDraft } = useFormDraft({
		draftKey: "doctor_application_draft",
		watch,
		reset,
		files: {
			cinRecto,
			cinVerso,
			medicalCouncilCertificate,
		},
		setFiles: {
			cinRecto: setCinRecto,
			cinVerso: setCinVerso,
			medicalCouncilCertificate: setMedicalCouncilCertificate,
		},
	});

	const handleCinFile = (side: "recto" | "verso", file: File) => {
		const MAX_FILE_SIZE = 5 * 1024 * 1024;
		if (file.size > MAX_FILE_SIZE) {
			if (side === "recto") {
				setCinRectoError("File size exceeds 5MB");
			} else {
				setCinVersoError("File size exceeds 5MB");
			}
			return;
		}

		if (side === "recto") {
			setCinRecto(file);
			setCinRectoError(null);
		} else {
			setCinVerso(file);
			setCinVersoError(null);
		}
	};

	const handleMedicalCouncilCertificateFile = (file: File) => {
		const MAX_FILE_SIZE = 5 * 1024 * 1024;
		if (file.size > MAX_FILE_SIZE) {
			setMedicalCouncilCertificateError("File size exceeds 5MB");
			return;
		}
		setMedicalCouncilCertificate(file);
		setMedicalCouncilCertificateError(null);
	};

	const onSubmit = async (data: FormValues) => {
		if (!cinRecto) {
			setCinRectoError("CIN Recto is required");
			return;
		}
		if (!cinVerso) {
			setCinVersoError("CIN Verso is required");
			return;
		}
		if (!medicalCouncilCertificate) {
			setMedicalCouncilCertificateError(
				"Medical Council Certificate is required",
			);
			return;
		}

		try {
			const cinRectoUrl = await uploadToR2(cinRecto, "doctor-applications");
			const cinVersoUrl = await uploadToR2(cinVerso, "doctor-applications");
			const certUrl = await uploadToR2(
				medicalCouncilCertificate,
				"doctor-applications",
			);

			await createDoctorApplication({
				...data,
				cabinetCityId: data.cabinetCityId
					? Number.parseInt(data.cabinetCityId)
					: undefined,
				specialityId: Number.parseInt(data.specialityId),
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

	return (
		<FormProvider {...methods}>
			<form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-4">
				<PersonalInfo
					cinRecto={cinRecto}
					setCinRecto={setCinRecto}
					cinRectoError={cinRectoError}
					cinVerso={cinVerso}
					setCinVerso={setCinVerso}
					cinVersoError={cinVersoError}
					handleCinFile={handleCinFile}
				/>
				<ProfessionalInfo
					specialities={specialities}
					medicalCouncilCertificate={medicalCouncilCertificate}
					setMedicalCouncilCertificate={setMedicalCouncilCertificate}
					medicalCouncilCertificateError={medicalCouncilCertificateError}
					handleMedicalCouncilCertificateFile={
						handleMedicalCouncilCertificateFile
					}
				/>
				<BusinessInfo cities={cities} />
				<Button type="submit" className="mt-4 w-full" disabled={sending}>
					{sending ? "Submitting..." : "Apply For Verification"}
				</Button>
			</form>
		</FormProvider>
	);
}
