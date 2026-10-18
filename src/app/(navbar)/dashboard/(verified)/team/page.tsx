import TeamPanel from "@/components/dashboard/team/team-panel";
import DashboardLayout from "@/components/layouts/dashboard-layout";

export default function TeamPage() {
	return (
		<DashboardLayout title="Team">
			<TeamPanel />
		</DashboardLayout>
	);
}
