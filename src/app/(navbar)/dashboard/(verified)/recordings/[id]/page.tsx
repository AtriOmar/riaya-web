import RecordingDetail from "@/components/dashboard/recordings/recording-detail";
import DashboardLayout from "@/components/layouts/dashboard-layout";

export default async function RecordingDetailPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = await params;
	return (
		<DashboardLayout title="Recording">
			<RecordingDetail recordingId={Number(id)} />
		</DashboardLayout>
	);
}
