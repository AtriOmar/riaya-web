import ApplicationsTable from "@/components/admin/applications-table";
import AdminLayout from "@/components/layouts/admin-layout";

export default function AdminDoctorApplicationsPage() {
	return (
		<AdminLayout title="Doctor Applications">
			<ApplicationsTable />
		</AdminLayout>
	);
}
