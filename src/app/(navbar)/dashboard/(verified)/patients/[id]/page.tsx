"use client";

import { useParams } from "next/navigation";
import Patient from "@/components/dashboard/patients/[id]/patient";
import DashboardLayout from "@/components/layouts/dashboard-layout";

export default function PatientPage() {
	const params = useParams<{ id: string }>();

	return (
		<DashboardLayout title="Patient Details">
			<Patient patientId={Number(params.id)} />
		</DashboardLayout>
	);
}
