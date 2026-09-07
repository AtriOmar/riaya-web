import { Maximize2, Minimize2 } from "lucide-react";
import moment from "moment";
import { cn } from "@/lib/utils";

type Props = {
	day: Date;
	count: number;
	isToday: boolean;
	expanded: boolean;
	onClick: () => void;
	onToggleExpand: () => void;
};

export default function DayHeader({
	day,
	count,
	isToday,
	expanded,
	onClick,
	onToggleExpand,
}: Props) {
	const dayName = moment(day).format("ddd");
	const dayNum = day.getDate();

	return (
		<div
			className={cn(
				"relative flex flex-col items-center justify-center gap-0.5 py-3 min-w-0",
				"border-l border-b border-border",
				"transition-colors duration-150",
				isToday && "bg-primary/[0.03]",
				expanded && "bg-muted/30",
			)}
		>
			<button
				type="button"
				onClick={onClick}
				className={cn(
					"flex flex-col items-center justify-center gap-0.5 w-full",
					"cursor-pointer select-none",
					"hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset rounded-sm",
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

				{count > 0 ? (
					<span
						className={cn(
							"mt-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none",
							count >= 5
								? "bg-green-500/25 text-green-700 dark:text-green-400"
								: count >= 3
									? "bg-green-500/20 text-green-700 dark:text-green-400"
									: "bg-green-500/15 text-green-600 dark:text-green-400",
						)}
					>
						{count} dr
					</span>
				) : (
					<span className="mt-0.5 text-[10px] text-muted-foreground/40 leading-none">
						—
					</span>
				)}
			</button>

			<button
				type="button"
				title={expanded ? "Collapse day" : "Expand day"}
				aria-label={expanded ? "Collapse day" : "Expand day"}
				aria-pressed={expanded}
				onClick={(e) => {
					e.stopPropagation();
					onToggleExpand();
				}}
				className={cn(
					"absolute top-1.5 right-1.5 flex items-center justify-center size-6 rounded-md",
					"text-muted-foreground hover:text-foreground hover:bg-muted",
					"transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
					expanded && "text-primary bg-primary/10 hover:bg-primary/15",
				)}
			>
				{expanded ? (
					<Minimize2 className="size-3.5" />
				) : (
					<Maximize2 className="size-3.5" />
				)}
			</button>
		</div>
	);
}
