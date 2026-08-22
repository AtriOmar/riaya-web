"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type SidebarItemData = {
	name: string;
	icon: ReactNode;
	path: string;
	strict?: boolean;
	disabled?: boolean;
};

export default function SidebarItem({ item }: { item: SidebarItemData }) {
	const pathname = usePathname();
	const isActive =
		(item.strict && pathname === item.path) ||
		(!item.strict && pathname.startsWith(item.path));

	const className = cn(
		"items-center gap-3 grid grid-cols-[20px_1fr] mt-1 px-3 py-2.5 rounded-lg transition duration-200",
		isActive && !item.disabled
			? "bg-primary hover:bg-primary/90 text-primary-foreground"
			: "hover:bg-muted text-foreground",
		item.disabled && "opacity-50 cursor-not-allowed hover:bg-transparent",
	);

	const content = (
		<>
			{item.icon}
			<span>{item.name}</span>
		</>
	);

	if (item.disabled) {
		return (
			<TooltipProvider>
				<Tooltip>
					<TooltipTrigger asChild>
						<div className={className}>{content}</div>
					</TooltipTrigger>
					<TooltipContent side="right">
						Verify your profile to access this page
					</TooltipContent>
				</Tooltip>
			</TooltipProvider>
		);
	}

	return (
		<Link href={item.path} className={className}>
			{content}
		</Link>
	);
}

export type { SidebarItemData };
