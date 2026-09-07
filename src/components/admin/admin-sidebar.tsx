"use client";

import {
	FileCheck,
	Home,
	List,
	MessageSquare,
	PanelLeftClose,
	PanelLeftOpen,
	Phone,
	Search,
	Settings,
	Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useAppContext } from "@/components/contexts/app-provider";
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

const STORAGE_KEY = "admin-sidebar-collapsed";

const items1: SidebarItemData[] = [
	{
		name: "Dashboard",
		icon: <Home className="size-5" />,
		path: "/admin",
		strict: true,
	},
	{
		name: "Doctor Applications",
		icon: <FileCheck className="size-5" />,
		path: "/admin/doctor-applications",
	},
	{
		name: "Best Fit Finder",
		icon: <Search className="size-5" />,
		path: "/admin/best-fit",
	},
	{
		name: "Specialities",
		icon: <List className="size-5" />,
		path: "/admin/specialities",
	},
	{ name: "Users", icon: <Users className="size-5" />, path: "/admin/users" },
	{
		name: "Live Calls",
		icon: <Phone className="size-5" />,
		path: "/admin/calls",
	},
	{
		name: "WhatsApp Config",
		icon: <MessageSquare className="size-5" />,
		path: "/admin/whatsapp-config",
	},
];

const items2: SidebarItemData[] = [
	{
		name: "Settings",
		icon: <Settings className="size-5" />,
		path: "/admin/settings",
	},
];

function AdminSidebarContent({ collapsed = false }: { collapsed?: boolean }) {
	return (
		<>
			<SidebarUserInfo isAdmin collapsed={collapsed} />
			<ul className={cn("font-medium text-sm", collapsed ? "px-1" : "px-2")}>
				{items1.map((item) => (
					<li key={item.path}>
						<SidebarItem item={item} collapsed={collapsed} />
					</li>
				))}
				<li>
					<div className="h-px my-2 bg-border" />
				</li>
				{items2.map((item) => (
					<li key={item.path}>
						<SidebarItem item={item} collapsed={collapsed} />
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

export default function AdminSidebar({
	children,
}: {
	children: React.ReactNode;
}) {
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
					<AdminSidebarContent collapsed={collapsed} />
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
					<AdminSidebarContent />
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
