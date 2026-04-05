import ApplicationsTable from "@/components/admin/applications-table";

export default function AdminDoctorApplicationsPage() {
	return (
		<div className="pr-2 md:pr-10 pb-20 pl-2">
			<h3 className="mb-4 font-bold text-2xl">Doctor Applications</h3>
			<ApplicationsTable />
		</div>
	);
}
