"use client";

import {
	Calendar,
	CalendarDays,
	Home,
	MessageSquare,
	PanelLeftClose,
	PanelLeftOpen,
	Settings,
	Stethoscope,
	User,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useAppContext } from "@/components/contexts/app-provider";
import { useAuth } from "@/components/contexts/auth-provider";
import SidebarItem, { type SidebarItemData } from "@/components/sidebar-item";
import SidebarUserInfo from "@/components/sidebar-user-info";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useGetApiUsersMe } from "@/services/generated/users/users";

const STORAGE_KEY = "dashboard-sidebar-collapsed";

const items1: SidebarItemData[] = [
	{
		name: "Dashboard",
		icon: <Home className="size-5" />,
		path: "/dashboard",
		strict: true,
	},
	{
		name: "Patients",
		icon: <Stethoscope className="size-5" />,
		path: "/dashboard/patients",
	},
	{
		name: "Appointments",
		icon: <CalendarDays className="size-5" />,
		path: "/dashboard/appointments",
	},
	{
		name: "Availability",
		icon: <Calendar className="size-5" />,
		path: "/dashboard/availability",
	},
];

const items2: SidebarItemData[] = [
	{
		name: "Profile",
		icon: <User className="size-5" />,
		path: "/dashboard/profile",
	},
	{
		name: "WhatsApp",
		icon: <MessageSquare className="size-5" />,
		path: "/dashboard/whatsapp-config",
	},
	{
		name: "Settings",
		icon: <Settings className="size-5" />,
		path: "/dashboard/settings",
	},
];

function SidebarContent({ collapsed = false }: { collapsed?: boolean }) {
	const { user } = useAuth();
	const { data: me } = useGetApiUsersMe({ swr: { enabled: !!user } });
	const isVerified = me?.doctorProfile?.status === "verified";

	return (
		<>
			<SidebarUserInfo collapsed={collapsed} />
			<ul className={cn("font-medium text-sm", collapsed ? "px-1" : "px-2")}>
				{items1.map((item) => (
					<li key={item.path}>
						<SidebarItem
							item={{
								...item,
								disabled: !isVerified && item.path !== "/dashboard/profile",
							}}
							collapsed={collapsed}
						/>
					</li>
				))}
				<li>
					<div className="h-px my-2 bg-border" />
				</li>
				{items2.map((item) => (
					<li key={item.path}>
						<SidebarItem
							item={{
								...item,
								disabled: !isVerified && item.path !== "/dashboard/profile",
							}}
							collapsed={collapsed}
						/>
					</li>
				))}
			</ul>
		</>
	);
}

function useCollapsedState() {
	const [collapsed, setCollapsed] = useState(false);
	const [ready, setReady] = useState(false);

	useEffect(() => {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored === "true") setCollapsed(true);
		setReady(true);
	}, []);

	const toggle = () => {
		setCollapsed((prev) => {
			const next = !prev;
			localStorage.setItem(STORAGE_KEY, String(next));
			return next;
		});
	};

	return { collapsed, ready, toggle };
}

export default function Sidebar({ children }: { children: React.ReactNode }) {
	const { showMobileSidebar, setShowMobileSidebar, isMobile } = useAppContext();
	const { collapsed, ready, toggle } = useCollapsedState();

	return (
		<>
			{/* Desktop Sidebar */}
			<div
				className={cn(
					"hidden md:flex flex-col top-[70px] bottom-[15px] left-[15px] fixed overflow-hidden border rounded-xl bg-background transition-[width] duration-200",
					collapsed ? "w-[68px]" : "w-[230px]",
					!ready && "opacity-0",
				)}
			>
				<div className="flex-1 overflow-y-auto overflow-x-hidden">
					<SidebarContent collapsed={collapsed} />
				</div>
				<div
					className={cn(
						"border-t p-2",
						collapsed ? "flex justify-center" : "flex justify-end",
					)}
				>
					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								variant="ghost"
								size="icon"
								className="size-8"
								onClick={toggle}
								aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
							>
								{collapsed ? (
									<PanelLeftOpen className="size-4" />
								) : (
									<PanelLeftClose className="size-4" />
								)}
							</Button>
						</TooltipTrigger>
						<TooltipContent side="right">
							{collapsed ? "Expand" : "Collapse"}
						</TooltipContent>
					</Tooltip>
				</div>
			</div>

			{/* Mobile Sidebar */}
			<Sheet
				open={isMobile && showMobileSidebar}
				onOpenChange={setShowMobileSidebar}
			>
				<SheetContent side="left" className="w-[280px] p-0">
					<SidebarContent />
				</SheetContent>
			</Sheet>

			<div
				className={cn(
					"mt-[70px] transition-[margin] duration-200",
					collapsed ? "md:ml-[98px]" : "md:ml-[260px]",
				)}
			>
				{children}
			</div>
		</>
	);
}
