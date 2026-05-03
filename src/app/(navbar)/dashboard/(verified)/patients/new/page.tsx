import NewPatientForm from "@/components/dashboard/patients/new-patient-form";
import DashboardLayout from "@/components/layouts/dashboard-layout";

export default function NewPatientPage() {
	return (
		<DashboardLayout title="New Patient">
			<NewPatientForm />
		</DashboardLayout>
	);
}
