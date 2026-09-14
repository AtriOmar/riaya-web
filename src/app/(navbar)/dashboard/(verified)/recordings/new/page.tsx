import NewRecording from "@/components/dashboard/recordings/new-recording";
import DashboardLayout from "@/components/layouts/dashboard-layout";

export default function NewRecordingPage() {
	return (
		<DashboardLayout title="New Recording">
			<NewRecording />
		</DashboardLayout>
	);
}
