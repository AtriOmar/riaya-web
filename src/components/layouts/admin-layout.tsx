import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type AdminLayoutProps = {
	title: ReactNode;
	children: ReactNode;
	className?: string;
};

export default function AdminLayout({
	title,
	children,
	className,
}: AdminLayoutProps) {
	return (
		<div className={cn("pr-2 md:pr-10 pb-20 pl-2", className)}>
			<h3 className="mb-4 font-bold text-2xl">{title}</h3>
			{children}
		</div>
	);
}
