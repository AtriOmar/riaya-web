import PatientsList from "@/components/dashboard/patients/patients-list";
import DashboardLayout from "@/components/layouts/dashboard-layout";

export default function PatientsPage() {
	return (
		<DashboardLayout title="Patients">
			<PatientsList />
		</DashboardLayout>
	);
}
