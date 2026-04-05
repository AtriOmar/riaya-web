"use client";

import { useParams } from "next/navigation";
import PatientDetail from "@/components/dashboard/patients/patient-detail";

export default function PatientPage() {
	const params = useParams<{ id: string }>();

	return (
		<div className="pr-2 md:pr-10 pb-20 pl-2">
			<h3 className="mb-4 font-bold text-2xl">Patient Details</h3>
			<PatientDetail patientId={Number(params.id)} />
		</div>
	);
}
