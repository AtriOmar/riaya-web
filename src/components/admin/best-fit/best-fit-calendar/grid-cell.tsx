import type { BestFitRangeDoctor } from "@/hooks/use-best-fit-range";
import { cn } from "@/lib/utils";
import { CHIP_COLORS } from "../shared/constants";
import { MAX_CHIPS, MAX_CHIPS_EXPANDED, SLOT_HEIGHT } from "./constants";
import DoctorChip from "./doctor-chip";

type Props = {
	doctors: BestFitRangeDoctor[];
	day: Date;
	isToday: boolean;
	expanded: boolean;
	onSelectDate: (d: Date) => void;
	onSelectDoctor: (id: number, d: Date) => void;
};

export default function GridCell({
	doctors,
	day,
	isToday,
	expanded,
	onSelectDate,
	onSelectDoctor,
}: Props) {
	const maxChips = expanded ? MAX_CHIPS_EXPANDED : MAX_CHIPS;
	const visible = doctors.slice(0, maxChips);
	const overflow = doctors.length - visible.length;

	return (
		// biome-ignore lint/a11y/useKeyWithClickEvents: calendar grid cell
		<div
			onClick={() => onSelectDate(day)}
			className={cn(
				"grid content-center items-stretch gap-0.5 px-1.5 min-w-0 overflow-hidden",
				expanded ? "grid-cols-3" : "grid-cols-2",
				"border-l border-b border-border/50 cursor-pointer transition-colors duration-100",
				doctors.length > 0
					? "bg-green-500/[0.03] hover:bg-green-500/10"
					: cn("hover:bg-muted/40", isToday && "bg-primary/[0.025]"),
				isToday && doctors.length > 0 && "bg-primary/[0.025]",
				expanded && "bg-muted/20",
			)}
			style={{ height: SLOT_HEIGHT }}
		>
			{visible.map((doctor, i) => (
				<DoctorChip
					key={`${doctor.id}`}
					doctor={doctor}
					colorClass={CHIP_COLORS[i % CHIP_COLORS.length]}
					day={day}
					onSelectDoctor={onSelectDoctor}
				/>
			))}
			{overflow > 0 && (
				<span className="flex items-center text-[11px] font-medium text-muted-foreground shrink-0 leading-none">
					+{overflow}
				</span>
			)}
		</div>
	);
}
