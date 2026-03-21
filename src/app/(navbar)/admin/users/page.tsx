import UsersTable from "@/components/admin/users-table";

export default function AdminUsersPage() {
  return (
    <div className="pr-2 md:pr-10 pb-20 pl-2">
      <h3 className="mb-4 font-bold text-2xl">Users</h3>
      <UsersTable />
    </div>
  );
}
