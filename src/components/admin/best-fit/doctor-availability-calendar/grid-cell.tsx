import type { AdminDoctorAppointment } from "@/hooks/use-admin-doctor";
import { cn } from "@/lib/utils";
import { fmtMinutes } from "../shared/helpers";
import AppointmentChip from "./appointment-chip";
import { SLOT_HEIGHT } from "./constants";

type Props = {
	minutes: number;
	isToday: boolean;
	available: boolean;
	appointments: AdminDoctorAppointment[];
	busy: boolean;
};

export default function GridCell({
	minutes,
	isToday,
	available,
	appointments,
	busy,
}: Props) {
	const hasAppts = appointments.length > 0;

	return (
		<div
			className={cn(
				"flex flex-col justify-center gap-0.5 px-1.5 min-w-0 overflow-hidden",
				"border-l border-b border-border/50 transition-colors duration-100",
				hasAppts || busy
					? "bg-primary/[0.04]"
					: available
						? "bg-green-500/[0.08]"
						: cn(
								"bg-slate-200/60 dark:bg-muted/40",
								isToday && "bg-primary/[0.025]",
							),
			)}
			style={{ height: SLOT_HEIGHT }}
		>
			{hasAppts ? (
				appointments.map((a) => <AppointmentChip key={a.id} appointment={a} />)
			) : busy ? (
				<span className="text-[10px] font-medium text-primary/50 px-0.5">
					···
				</span>
			) : available ? (
				<span className="text-[10px] font-medium text-green-700/80 dark:text-green-400/80 px-0.5">
					{fmtMinutes(minutes)}
				</span>
			) : null}
		</div>
	);
}
