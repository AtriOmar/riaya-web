"use client";

import { CubeLoader } from "@/components/loaders";
import { usePractice } from "@/hooks/use-practice";
import { useGetApiPatientsId } from "@/services/generated/patients/patients";
import { AddMedicalFile } from "./add-medical-file";
import { PatientDetails } from "./patient-details";
import { PatientHistory } from "./patient-history";
import { PatientInvoices } from "./patient-invoices";

export default function Patient({ patientId }: { patientId: number }) {
	const {
		data: patient,
		isLoading,
		mutate,
	} = useGetApiPatientsId(patientId.toString());
	// The medical history (files and recordings) is for the doctor only
	const { isSecretary } = usePractice();

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
			{!isSecretary && (
				<div className="gap-6 grid lg:grid-cols-3">
					<PatientHistory
						patientId={patientId}
						medicalFiles={patient.medicalFiles}
						onChanged={() => mutate()}
					/>
					<AddMedicalFile patientId={patientId} onFileAdded={() => mutate()} />
				</div>
			)}
			<PatientInvoices
				patientId={patientId}
				invoices={patient.invoices ?? []}
				onChanged={() => mutate()}
			/>
		</div>
	);
}
