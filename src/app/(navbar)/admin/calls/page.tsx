import LiveCalls from "@/components/admin/calls/live-calls";
import AdminLayout from "@/components/layouts/admin-layout";

export default function CallsPage() {
	return (
		<AdminLayout title="Calls">
			<LiveCalls />
		</AdminLayout>
	);
}
