import { cn } from "@/lib/utils";
import { fmtMinutes } from "../shared/helpers";
import { SLOT_HEIGHT, TIME_GUTTER_W } from "./constants";

export default function TimeGutter({ minutes }: { minutes: number }) {
	const isHour = minutes % 60 === 0;
	return (
		<div
			className={cn(
				"flex items-start justify-end pr-3 pt-1.5 select-none shrink-0",
				isHour
					? "text-[11px] font-medium text-muted-foreground"
					: "text-[10px] text-muted-foreground/50",
			)}
			style={{ height: SLOT_HEIGHT, width: TIME_GUTTER_W }}
		>
			{isHour ? fmtMinutes(minutes) : ""}
		</div>
	);
}
