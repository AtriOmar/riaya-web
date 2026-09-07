import moment from "moment";
import { cn } from "@/lib/utils";

type Props = {
	day: Date;
	isToday: boolean;
	apptCount: number;
};

export default function DayHeader({ day, isToday, apptCount }: Props) {
	const dayName = moment(day).format("ddd");
	const dayNum = day.getDate();

	return (
		<div
			className={cn(
				"flex flex-col items-center justify-center gap-0.5 py-3 min-w-0",
				"border-l border-b border-border select-none",
				isToday && "bg-primary/[0.03]",
			)}
		>
			<span
				className={cn(
					"text-[11px] font-semibold uppercase tracking-wide",
					isToday ? "text-primary" : "text-muted-foreground",
				)}
			>
				{dayName}
			</span>
			<span
				className={cn(
					"flex items-center justify-center rounded-full text-sm font-bold leading-none",
					isToday
						? "size-7 bg-primary text-primary-foreground"
						: "size-7 text-foreground",
				)}
			>
				{dayNum}
			</span>
			{apptCount > 0 ? (
				<span className="mt-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none bg-primary/15 text-primary">
					{apptCount} appt{apptCount === 1 ? "" : "s"}
				</span>
			) : (
				<span className="mt-0.5 text-[10px] text-muted-foreground/40 leading-none">
					—
				</span>
			)}
		</div>
	);
}
