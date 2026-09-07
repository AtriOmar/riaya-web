import type { BestFitRangeDoctor } from "@/hooks/use-best-fit-range";
import { cn } from "@/lib/utils";
import { CHIP_COLORS } from "../shared/constants";
import { fmtMinutes } from "../shared/helpers";
import { TIME_GUTTER_W } from "./constants";
import DoctorChip from "./doctor-chip";

type Props = {
	minutes: number;
	doctors: BestFitRangeDoctor[];
	date: Date;
	visibleCount: number;
	onShowMore: () => void;
	onSelectDoctor: (id: number, d: Date) => void;
};

export default function TimeSlotRow({
	minutes,
	doctors,
	date,
	visibleCount,
	onShowMore,
	onSelectDoctor,
}: Props) {
	const isHour = minutes % 60 === 0;
	const visible = doctors.slice(0, visibleCount);
	const remaining = Math.max(0, doctors.length - visible.length);

	return (
		<div
			className={cn(
				"grid items-stretch",
				isHour && "border-t border-border/40",
			)}
			style={{ gridTemplateColumns: `${TIME_GUTTER_W}px 1fr` }}
		>
			<div
				className={cn(
					"flex items-start justify-end pr-3 pt-2.5 select-none shrink-0 border-r border-border/50",
					isHour
						? "text-[11px] font-medium text-muted-foreground"
						: "text-[10px] text-muted-foreground/60",
				)}
			>
				{fmtMinutes(minutes)}
			</div>

			<div
				className={cn(
					"min-w-0 px-2 py-1.5 border-b border-border/40",
					doctors.length > 0 ? "bg-green-500/[0.03]" : "bg-transparent",
				)}
			>
				{doctors.length === 0 ? (
					<div className="h-8 flex items-center px-1 text-[11px] text-muted-foreground/40">
						—
					</div>
				) : (
					<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-1.5">
						{visible.map((doctor, i) => (
							<DoctorChip
								key={doctor.id}
								doctor={doctor}
								colorClass={CHIP_COLORS[i % CHIP_COLORS.length]}
								date={date}
								onSelectDoctor={onSelectDoctor}
							/>
						))}
						{remaining > 0 && (
							<button
								type="button"
								onClick={onShowMore}
								className={cn(
									"flex items-center justify-center rounded-md border border-dashed",
									"border-muted-foreground/30 px-2 py-1.5 min-h-[42px]",
									"text-xs font-medium text-muted-foreground",
									"hover:bg-muted hover:text-foreground hover:border-muted-foreground/50",
									"transition-colors",
								)}
							>
								+{remaining} more
							</button>
						)}
					</div>
				)}
			</div>
		</div>
	);
}
