"use client";

import { useAuth } from "@/components/contexts/auth-provider";
import { ProPlanBadge } from "@/components/dashboard/subscription/pro-plan-badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function SidebarUserInfo({
	isAdmin = false,
	collapsed = false,
	planBadge,
}: {
	isAdmin?: boolean;
	collapsed?: boolean;
	/** e.g. "Pro" — shown for subscribers */
	planBadge?: string | null;
}) {
	const { user } = useAuth();
	const initials = (user?.username ?? user?.name ?? "U")
		.slice(0, 2)
		.toUpperCase();

	const isPro = planBadge?.toLowerCase() === "pro";
	const badgeEl = isPro ? <ProPlanBadge compact={collapsed} /> : null;

	if (collapsed) {
		return (
			<div className="flex flex-col items-center gap-1.5 py-3">
				{isAdmin && (
					<span className="font-medium text-[10px] text-primary uppercase tracking-wide">
						Admin
					</span>
				)}
				{badgeEl}
				<Avatar className="size-8 border-2 border-background shadow-sm">
					<AvatarImage src={user?.image ?? undefined} alt={user?.name ?? ""} />
					<AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
				</Avatar>
			</div>
		);
	}

	return (
		<>
			<div className="after:z-[-1] isolate after:absolute relative after:inset-0 h-[100px] bg-[url(/sidebar-background.jpg)] after:bg-primary/50 bg-cover bg-center">
				{isAdmin && (
					<div className="absolute flex items-center gap-1 px-2 py-1 rounded-br-lg bg-primary/90 shadow-md text-primary-foreground">
						<span className="font-medium text-xs">Admin</span>
					</div>
				)}
				{badgeEl && (
					<div className="absolute top-2 right-2">{badgeEl}</div>
				)}
				<div className="bottom-0 left-1/2 absolute -translate-x-1/2 translate-y-1/3">
					<Avatar className="w-[72px] h-[72px] border-[3px] border-background">
						<AvatarImage
							src={user?.image ?? undefined}
							alt={user?.name ?? ""}
						/>
						<AvatarFallback className="text-lg">{initials}</AvatarFallback>
					</Avatar>
				</div>
			</div>
			<h4 className="mt-8 font-semibold text-lg text-center capitalize">
				{user?.username ?? user?.name}
			</h4>
		</>
	);
}
