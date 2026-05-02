"use client";

import useSWR from "swr";
import { CubeLoader } from "@/components/loaders";
import { getPatientById } from "@/services";
import { AddMedicalFile } from "./add-medical-file";
import { PatientDetails } from "./patient-details";
import { PatientMedicalFilesList } from "./patient-medical-files-list";

export default function Patient({ patientId }: { patientId: number }) {
	const {
		data: patient,
		isLoading,
		mutate,
	} = useSWR(`patient-${patientId}`, () => getPatientById(patientId));

	if (isLoading) {
		return (
			<div className="flex justify-center py-16">
				<CubeLoader />
			</div>
		);
	}

	if (!patient)
		return <p className="text-muted-foreground">Patient not found.</p>;

	return (
		<div className="space-y-6">
			<PatientDetails patient={patient} />
			<div className="gap-6 grid lg:grid-cols-3">
				<PatientMedicalFilesList medicalFiles={patient.medicalFiles} />
				<AddMedicalFile patientId={patientId} onFileAdded={() => mutate()} />
			</div>
		</div>
	);
}
