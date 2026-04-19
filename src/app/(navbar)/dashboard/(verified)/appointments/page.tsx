import AppointmentsCalendar from "@/components/dashboard/appointments/calendar";

export default function AppointmentsPage() {
	return (
		<div className="pr-2 md:pr-10 pb-20 pl-2">
			<h3 className="font-bold text-2xl">Appointments</h3>
			<AppointmentsCalendar />
		</div>
	);
}
