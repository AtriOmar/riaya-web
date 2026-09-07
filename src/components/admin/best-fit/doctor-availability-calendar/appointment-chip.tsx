import type { AdminDoctorAppointment } from "@/hooks/use-admin-doctor";
import { cn } from "@/lib/utils";
import { appointmentLabel } from "./helpers";

export default function AppointmentChip({
	appointment,
}: {
	appointment: AdminDoctorAppointment;
}) {
	const pending = appointment.status === "pending";
	const startsAt = appointment.start
		? new Date(appointment.start).toLocaleTimeString("en-GB", {
				hour: "2-digit",
				minute: "2-digit",
			})
		: null;
	const endsAt = appointment.end
		? new Date(appointment.end).toLocaleTimeString("en-GB", {
				hour: "2-digit",
				minute: "2-digit",
			})
		: null;
	const title = [
		appointmentLabel(appointment),
		startsAt && endsAt ? `${startsAt}–${endsAt}` : null,
		appointment.status,
	]
		.filter(Boolean)
		.join(" · ");

	return (
		<div
			title={title}
			className={cn(
				"flex flex-col items-start gap-0.5 rounded border px-1.5 py-0.5 w-full min-w-0",
				pending
					? "bg-yellow-600 text-white border-yellow-700"
					: "bg-primary text-primary-foreground border-primary",
			)}
		>
			<span className="truncate w-full text-[11px] font-medium leading-none">
				{appointmentLabel(appointment)}
			</span>
			{startsAt && endsAt ? (
				<span className="truncate w-full text-[9px] font-normal leading-none opacity-80">
					{startsAt}–{endsAt}
				</span>
			) : null}
		</div>
	);
}
