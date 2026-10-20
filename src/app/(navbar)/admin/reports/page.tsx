import ReportsManager from "@/components/admin/reports/reports-manager";
import AdminLayout from "@/components/layouts/admin-layout";

export default function ReportedCallsPage() {
	return (
		<AdminLayout title="Reported calls">
			<ReportsManager />
		</AdminLayout>
	);
}
