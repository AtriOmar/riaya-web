import { cn } from "@/lib/utils";

const SIZE = 80;
const STROKE = 7;

function usageTone(used: number, limit: number | null) {
	if (limit == null || limit <= 0) {
		return "unlimited" as const;
	}
	if (used >= limit) {
		return "full" as const;
	}
	if (used / limit >= 0.8) {
		return "high" as const;
	}
	return "ok" as const;
}

export function UsageMeter({
	label,
	used,
	limit,
}: {
	label: string;
	used: number;
	limit: number | null;
}) {
	const tone = usageTone(used, limit);
	const unlimited = tone === "unlimited";
	const ratio = unlimited ? 1 : Math.min(used / Math.max(limit ?? 1, 1), 1);
	const radius = (SIZE - STROKE) / 2;
	const circumference = 2 * Math.PI * radius;
	const offset = circumference * (1 - ratio);

	return (
		<div className="flex items-center gap-4 rounded-xl border bg-card px-4 py-3">
			<div className="relative size-[80px] shrink-0" aria-hidden>
				<svg
					width={SIZE}
					height={SIZE}
					viewBox={`0 0 ${SIZE} ${SIZE}`}
					className="-rotate-90"
				>
					<title>{label} usage</title>
					<circle
						cx={SIZE / 2}
						cy={SIZE / 2}
						r={radius}
						fill="none"
						strokeWidth={STROKE}
						className="stroke-muted"
					/>
					{ratio > 0 && (
						<circle
							cx={SIZE / 2}
							cy={SIZE / 2}
							r={radius}
							fill="none"
							strokeWidth={STROKE}
							strokeLinecap="round"
							strokeDasharray={circumference}
							strokeDashoffset={offset}
							className={cn(
								"transition-[stroke-dashoffset] duration-500",
								tone === "full" && "stroke-destructive",
								tone === "high" && "stroke-amber-500",
								tone === "ok" && "stroke-primary",
								tone === "unlimited" && "stroke-primary/35",
							)}
						/>
					)}
				</svg>
				<div className="absolute inset-0 flex items-center justify-center">
					<span className="text-sm font-semibold tabular-nums leading-none text-foreground">
						{used}/{unlimited ? "∞" : limit}
					</span>
				</div>
			</div>
			<div className="min-w-0">
				<p className="text-sm font-medium leading-snug">{label}</p>
				{unlimited && (
					<p className="mt-0.5 text-sm text-muted-foreground">Unlimited</p>
				)}
			</div>
		</div>
	);
}
