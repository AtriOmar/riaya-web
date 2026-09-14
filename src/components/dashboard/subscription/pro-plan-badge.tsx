import { Crown } from "lucide-react";
import { cn } from "@/lib/utils";

/** Golden Pro badge with crown — used in doctor sidebar. */
export function ProPlanBadge({
	className,
	compact = false,
}: {
	className?: string;
	compact?: boolean;
}) {
	return (
		<span
			className={cn(
				"inline-flex items-center gap-1 rounded-md font-semibold uppercase tracking-wide",
				"bg-linear-to-b from-amber-300 via-yellow-400 to-amber-500",
				"text-amber-950 border border-amber-800/70",
				compact ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-[11px]",
				className,
			)}
		>
			<Crown
				className={cn(compact ? "size-2.5" : "size-3", "fill-amber-950/80")}
				aria-hidden
			/>
			Pro
		</span>
	);
}
