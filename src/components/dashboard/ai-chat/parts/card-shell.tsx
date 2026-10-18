import { format, isSameDay } from "date-fns";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/** The frame every tool and action card shares. */
export function CardShell({
	icon: Icon,
	title,
	subtitle,
	href,
	hrefLabel = "Open",
	children,
	className,
}: {
	icon: LucideIcon;
	title: string;
	subtitle?: string;
	href?: string;
	hrefLabel?: string;
	children?: React.ReactNode;
	className?: string;
}) {
	return (
		<div
			className={cn(
				"my-3 overflow-hidden rounded-xl border bg-background shadow-xs",
				className,
			)}
		>
			<div className="flex items-center gap-2.5 border-b bg-muted/30 px-3.5 py-2.5">
				<span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
					<Icon className="size-3.5" />
				</span>
				<div className="min-w-0 flex-1">
					<p className="truncate font-medium text-sm">{title}</p>
					{subtitle && (
						<p className="truncate text-muted-foreground text-xs">{subtitle}</p>
					)}
				</div>
				{href && (
					<Link
						href={href}
						className="shrink-0 rounded-md px-2 py-1 font-medium text-primary text-xs hover:bg-primary/10"
					>
						{hrefLabel}
					</Link>
				)}
			</div>
			{children}
		</div>
	);
}

/** Muted line inside a card when there is nothing to list. */
export function CardEmpty({ children }: { children: React.ReactNode }) {
	return (
		<p className="px-3.5 py-4 text-center text-muted-foreground text-sm">
			{children}
		</p>
	);
}

const STATUS_STYLES: Record<string, string> = {
	pending:
		"bg-amber-500/15 text-amber-800 dark:text-amber-200 border-amber-500/30",
	confirmed:
		"bg-emerald-500/15 text-emerald-800 dark:text-emerald-200 border-emerald-500/30",
	cancelled: "bg-muted text-muted-foreground border-border",
	unpaid:
		"bg-amber-500/15 text-amber-800 dark:text-amber-200 border-amber-500/30",
	partially_paid:
		"bg-sky-500/15 text-sky-800 dark:text-sky-200 border-sky-500/30",
	paid: "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200 border-emerald-500/30",
};

const STATUS_LABELS: Record<string, string> = {
	pending: "Pending",
	confirmed: "Confirmed",
	cancelled: "Cancelled",
	unpaid: "Unpaid",
	partially_paid: "Partly paid",
	paid: "Paid",
};

export function StatusPill({ status }: { status: string | null }) {
	if (!status) return null;
	return (
		<span
			className={cn(
				"inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 font-medium text-[11px]",
				STATUS_STYLES[status] ?? "bg-muted text-muted-foreground",
			)}
		>
			{STATUS_LABELS[status] ?? status}
		</span>
	);
}

/** "Tue 20 Oct, 10:30" (or "10:30–11:00" with an end on the same day). */
export function formatWhen(start: string | null, end?: string | null) {
	if (!start) return "No time set";
	const s = new Date(start);
	const base = format(s, "EEE d MMM, HH:mm");
	if (!end) return base;
	const e = new Date(end);
	return isSameDay(s, e)
		? `${base}–${format(e, "HH:mm")}`
		: `${base} – ${format(e, "EEE d MMM, HH:mm")}`;
}

export function formatDay(date: string) {
	return format(new Date(`${date}T00:00:00`), "EEE d MMM");
}
