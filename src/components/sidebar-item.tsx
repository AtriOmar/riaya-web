"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { ProPlanBadge } from "@/components/dashboard/subscription/pro-plan-badge";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type SidebarItemData = {
	name: string;
	icon: ReactNode;
	path: string;
	strict?: boolean;
	disabled?: boolean;
	badge?: string;
	/** Warning shown as a red "!" after the name (a dot on the icon when collapsed), and as the tooltip. */
	alert?: string;
};

export default function SidebarItem({
	item,
	collapsed = false,
}: {
	item: SidebarItemData;
	collapsed?: boolean;
}) {
	const pathname = usePathname();
	const isActive =
		(item.strict && pathname === item.path) ||
		(!item.strict && pathname.startsWith(item.path));

	const className = cn(
		"items-center rounded-lg transition duration-200",
		collapsed
			? "flex justify-center mt-1 mx-auto size-10"
			: "grid grid-cols-[20px_1fr] gap-3 mt-1 px-3 py-2.5",
		isActive && !item.disabled
			? "bg-primary hover:bg-primary/90 text-primary-foreground dark:text-primary-950"
			: "hover:bg-muted text-foreground",
		item.disabled && "opacity-50 cursor-not-allowed hover:bg-transparent",
	);

	const isProBadge = item.badge?.toLowerCase() === "pro";

	const content = (
		<>
			<span className="relative flex">
				{item.icon}
				{item.alert && collapsed && (
					<span className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full border-2 border-background bg-destructive" />
				)}
			</span>
			{!collapsed && (
				<span className="flex items-center justify-between gap-2 min-w-0">
					<span className="truncate">{item.name}</span>
					{isProBadge ? (
						<ProPlanBadge compact />
					) : item.badge ? (
						<span
							className={cn(
								"shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
								isActive && !item.disabled
									? "bg-primary-foreground/20 text-primary-foreground dark:text-primary-950"
									: "bg-primary/10 text-primary",
							)}
						>
							{item.badge}
						</span>
					) : null}
					{item.alert && (
						<span
							role="img"
							aria-label={item.alert}
							className="flex size-5 shrink-0 items-center justify-center rounded-full bg-destructive text-xs font-bold text-white"
						>
							!
						</span>
					)}
				</span>
			)}
		</>
	);

	const tooltipLabel = item.disabled
		? "Verify your profile to access this page"
		: item.alert
			? `${item.name}: ${item.alert}`
			: item.badge
				? `${item.name} (${item.badge})`
				: item.name;

	if (item.disabled || collapsed || item.alert) {
		const trigger = item.disabled ? (
			<div className={className}>{content}</div>
		) : (
			<Link href={item.path} className={className}>
				{content}
			</Link>
		);

		return (
			<Tooltip>
				<TooltipTrigger asChild>{trigger}</TooltipTrigger>
				<TooltipContent side="right">{tooltipLabel}</TooltipContent>
			</Tooltip>
		);
	}

	return (
		<Link href={item.path} className={className}>
			{content}
		</Link>
	);
}

export type { SidebarItemData };
