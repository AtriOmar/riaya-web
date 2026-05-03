import AvailabilityForm from "@/components/dashboard/availability/availability-form";
import DashboardLayout from "@/components/layouts/dashboard-layout";

export default function AvailabilityPage() {
	return (
		<DashboardLayout title="Availability">
			<AvailabilityForm />
		</DashboardLayout>
	);
}
