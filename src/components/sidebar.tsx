"use client";

import {
	Calendar,
	CalendarDays,
	Home,
	MessageSquare,
	Settings,
	Stethoscope,
	User,
} from "lucide-react";
import { useAppContext } from "@/components/contexts/app-provider";
import { useAuth } from "@/components/contexts/auth-provider";
import SidebarItem, { type SidebarItemData } from "@/components/sidebar-item";
import SidebarUserInfo from "@/components/sidebar-user-info";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useGetApiUsersMe } from "@/services/generated/users/users";

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

function SidebarContent() {
	const { user } = useAuth();
	const { data: me } = useGetApiUsersMe({ swr: { enabled: !!user } });
	const isVerified = me?.doctorProfile?.status === "verified";

	return (
		<>
			<SidebarUserInfo />
			<ul className="px-2 font-medium text-sm">
				{items1.map((item) => (
					<li key={item.path}>
						<SidebarItem
							item={{
								...item,
								disabled: !isVerified && item.path !== "/dashboard/profile",
							}}
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
						/>
					</li>
				))}
			</ul>
		</>
	);
}

export default function Sidebar() {
	const { showMobileSidebar, setShowMobileSidebar, isMobile } = useAppContext();

	return (
		<>
			{/* Desktop Sidebar */}
			<div className="hidden md:block top-[70px] bottom-[15px] left-[15px] fixed w-[230px] overflow-hidden rounded-xl bg-background border">
				<SidebarContent />
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
		</>
	);
}
