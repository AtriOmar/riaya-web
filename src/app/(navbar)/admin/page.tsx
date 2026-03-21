import ApplicationsTable from "@/components/admin/applications-table";
import AdminStats from "@/components/admin/stats";

export default function AdminDashboardPage() {
  return (
    <div className="pr-2 md:pr-10 pb-20 pl-2">
      <h3 className="font-bold text-2xl">Admin Dashboard</h3>
      <div className="space-y-6 mt-4">
        <AdminStats />
        <ApplicationsTable />
      </div>
    </div>
  );
}
