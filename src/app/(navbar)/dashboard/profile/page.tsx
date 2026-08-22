import Profile from "@/components/dashboard/profile/profile";
import DashboardLayout from "@/components/layouts/dashboard-layout";

export default function ProfilePage() {
	return (
		<DashboardLayout title="Profile" className="max-w-4xl">
			<Profile />
		</DashboardLayout>
	);
}
