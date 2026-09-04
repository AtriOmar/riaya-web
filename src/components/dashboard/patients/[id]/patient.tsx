"use client";

import { CubeLoader } from "@/components/loaders";
import { useGetApiPatientsId } from "@/services/generated/patients/patients";
import { AddMedicalFile } from "./add-medical-file";
import { PatientDetails } from "./patient-details";
import { PatientMedicalFilesList } from "./patient-medical-files-list";

export default function Patient({ patientId }: { patientId: number }) {
	const {
		data: patient,
		isLoading,
		mutate,
	} = useGetApiPatientsId(patientId.toString());

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
			<PatientDetails patient={patient} onUpdated={() => mutate()} />
			<div className="gap-6 grid lg:grid-cols-3">
				<PatientMedicalFilesList
					patientId={patientId}
					medicalFiles={patient.medicalFiles}
					onChanged={() => mutate()}
				/>
				<AddMedicalFile patientId={patientId} onFileAdded={() => mutate()} />
			</div>
		</div>
	);
}
