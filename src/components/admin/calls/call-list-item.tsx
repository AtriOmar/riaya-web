"use client";

import { Phone } from "lucide-react";
import type { CallData } from "@/hooks/use-realtime-socket";
import { cn } from "@/lib/utils";
import { getTimelinePreview, useCallDuration } from "./call-helpers";

type Props = {
	call: CallData;
	selected: boolean;
	onSelect: () => void;
};

export default function CallListItem({ call, selected, onSelect }: Props) {
	const duration = useCallDuration(call.startTime, call.endTime, call.duration);
	const isActive = call.status === "active";
	const preview = getTimelinePreview(call.timeline);
	const callerLabel = call.callerName || call.from || "Unknown caller";

	return (
		<button
			type="button"
			onClick={onSelect}
			className={cn(
				"w-full rounded-lg border px-3 py-3 text-left transition-colors",
				"hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
				selected
					? "border-primary/40 bg-primary/5 shadow-sm"
					: "border-border bg-card",
				isActive && !selected && "border-primary/15",
			)}
		>
			<div className="flex items-start gap-2.5">
				<div className="relative mt-0.5 shrink-0">
					<Phone
						className={cn(
							"size-4",
							isActive ? "text-primary" : "text-muted-foreground",
						)}
					/>
					{isActive && (
						<span className="-top-0.5 -right-0.5 absolute size-2 rounded-full bg-green-500" />
					)}
				</div>
				<div className="min-w-0 flex-1">
					<div className="flex items-center gap-2">
						<span
							className={cn(
								"shrink-0 rounded-full px-1.5 py-0.5 font-medium text-[10px] uppercase tracking-wide",
								isActive
									? "bg-primary/15 text-primary"
									: "bg-muted text-muted-foreground",
							)}
						>
							{isActive ? "Active" : "Ended"}
						</span>
						<span className="truncate font-medium text-sm">{callerLabel}</span>
						<span className="ml-auto shrink-0 font-mono text-muted-foreground text-xs tabular-nums">
							{duration}
						</span>
					</div>
					<p className="mt-1 line-clamp-2 text-muted-foreground text-xs leading-snug">
						{preview}
					</p>
				</div>
			</div>
		</button>
	);
}
