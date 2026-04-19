"use client";

import { FileCheck, Home, List, Phone, Settings, Users } from "lucide-react";
import { useAppContext } from "@/components/contexts/app-provider";
import SidebarItem, { type SidebarItemData } from "@/components/sidebar-item";
import SidebarUserInfo from "@/components/sidebar-user-info";
import { Sheet, SheetContent } from "@/components/ui/sheet";

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
];

const items2: SidebarItemData[] = [
	{
		name: "Settings",
		icon: <Settings className="size-5" />,
		path: "/admin/settings",
	},
];

function AdminSidebarContent() {
	return (
		<>
			<SidebarUserInfo isAdmin />
			<ul className="px-2 font-medium text-sm">
				{items1.map((item) => (
					<li key={item.path}>
						<SidebarItem item={item} />
					</li>
				))}
				<li>
					<div className="h-px my-2 bg-border" />
				</li>
				{items2.map((item) => (
					<li key={item.path}>
						<SidebarItem item={item} />
					</li>
				))}
			</ul>
		</>
	);
}

export default function AdminSidebar() {
	const { showMobileSidebar, setShowMobileSidebar, isMobile } = useAppContext();

	return (
		<>
			{/* Desktop Sidebar */}
			<div className="hidden md:block top-[70px] bottom-[15px] left-[15px] fixed w-[230px] overflow-hidden border rounded-xl bg-background">
				<AdminSidebarContent />
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
		</>
	);
}
