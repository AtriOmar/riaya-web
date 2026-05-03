import AppointmentsCalendar from "@/components/dashboard/appointments/calendar";
import DashboardLayout from "@/components/layouts/dashboard-layout";

export default function AppointmentsPage() {
	return (
		<DashboardLayout title="Appointments">
			<AppointmentsCalendar />
		</DashboardLayout>
	);
}
