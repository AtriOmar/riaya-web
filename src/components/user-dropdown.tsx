"use client";

import { ChevronDown, LayoutDashboard, LogOut } from "lucide-react";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
	HoverCard,
	HoverCardContent,
	HoverCardTrigger,
} from "@/components/ui/hover-card";
import { authClient } from "@/lib/auth-client";

type Props = {
	user: {
		id: string;
		name: string;
		email: string;
		image?: string | null;
		username?: string | null;
		accessId?: number | null;
	};
};

export default function UserDropdown({ user }: Props) {
	async function logout() {
		await authClient.signOut();
	}

	return (
		<HoverCard openDelay={100} closeDelay={100}>
			<HoverCardTrigger asChild>
				<div className="group flex items-center gap-2 px-2 py-1 rounded-full hover:bg-muted transition cursor-pointer">
					<Avatar className="w-8 h-8">
						<AvatarImage src={user.image ?? undefined} alt={user.name} />
						<AvatarFallback className="text-xs">
							{(user.username ?? user.name ?? "U").slice(0, 2).toUpperCase()}
						</AvatarFallback>
					</Avatar>

					<span className="hidden sm:block font-medium text-sm">
						{user.username ?? user.name ?? "User"}
					</span>

					<ChevronDown
						size={16}
						className="text-muted-foreground group-hover:rotate-180 transition-transform"
					/>
				</div>
			</HoverCardTrigger>

			<HoverCardContent
				align="end"
				sideOffset={8}
				className="w-48 p-2 border rounded-xl bg-background shadow-lg"
			>
				<Link
					href={user.accessId && user.accessId >= 3 ? "/admin" : "/dashboard"}
					className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-muted text-sm transition"
				>
					<LayoutDashboard size={16} />
					Dashboard
				</Link>

				<button
					type="button"
					onClick={logout}
					className="flex items-center gap-2 w-full mt-1 px-3 py-2 rounded-md hover:bg-destructive/10 text-destructive text-sm transition"
				>
					<LogOut size={16} />
					Logout
				</button>
			</HoverCardContent>
		</HoverCard>
	);
}
