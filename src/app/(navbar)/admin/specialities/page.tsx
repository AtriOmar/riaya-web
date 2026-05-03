import SpecialitiesManager from "@/components/admin/specialities-manager";
import AdminLayout from "@/components/layouts/admin-layout";

export default function AdminSpecialitiesPage() {
	return (
		<AdminLayout title="Specialities">
			<SpecialitiesManager />
		</AdminLayout>
	);
}
