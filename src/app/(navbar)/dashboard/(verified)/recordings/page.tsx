import RecordingsList from "@/components/dashboard/recordings/recordings-list";
import DashboardLayout from "@/components/layouts/dashboard-layout";

export default function RecordingsPage() {
	return (
		<DashboardLayout title="Recordings">
			<RecordingsList />
		</DashboardLayout>
	);
}
