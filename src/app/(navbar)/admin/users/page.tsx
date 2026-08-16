import UsersTable from "@/components/admin/users-table";
import AdminLayout from "@/components/layouts/admin-layout";

export default function AdminUsersPage() {
	return (
		<AdminLayout title="Users">
			<UsersTable />
		</AdminLayout>
	);
}
