"use client";

import {
	Bot,
	Calendar,
	CalendarDays,
	CreditCard,
	Home,
	MessageSquare,
	Mic,
	PanelLeftClose,
	PanelLeftOpen,
	Receipt,
	Stethoscope,
	User,
	Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useAppContext } from "@/components/contexts/app-provider";
import {
	AiPanelProvider,
	useAiPanel,
} from "@/components/dashboard/ai-chat/ai-panel";
import ReferralExclusionBanner from "@/components/dashboard/referral-exclusion-banner";
import SidebarItem, { type SidebarItemData } from "@/components/sidebar-item";
import SidebarUserInfo from "@/components/sidebar-user-info";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { isDoctorOnlyPath, usePractice } from "@/hooks/use-practice";
import { cn } from "@/lib/utils";
import { useGetApiBillingSubscription } from "@/services/generated/billing/billing";

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
		name: "Invoices",
		icon: <Receipt className="size-5" />,
		path: "/dashboard/invoices",
	},
	{
		name: "Recordings",
		icon: <Mic className="size-5" />,
		path: "/dashboard/recordings",
	},
	{
		name: "AI Assistant",
		icon: <Bot className="size-5" />,
		path: "/dashboard/ai-chat",
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
		name: "Team",
		icon: <Users className="size-5" />,
		path: "/dashboard/team",
	},
	{
		name: "WhatsApp",
		icon: <MessageSquare className="size-5" />,
		path: "/dashboard/whatsapp-config",
	},
	{
		name: "Subscription",
		icon: <CreditCard className="size-5" />,
		path: "/dashboard/subscription",
	},
];

function SidebarContent({ collapsed = false }: { collapsed?: boolean }) {
	const { practice, isSecretary, canWork } = usePractice();
	const { data: billing } = useGetApiBillingSubscription({
		swr: { enabled: canWork && !isSecretary },
	});

	const planBadge = billing?.plan.isPro ? "Pro" : null;
	// Secretaries only see the pages they can use
	const visible = (items: SidebarItemData[]) =>
		isSecretary ? items.filter((i) => !isDoctorOnlyPath(i.path)) : items;

	return (
		<>
			<SidebarUserInfo
				collapsed={collapsed}
				planBadge={planBadge}
				subtitle={
					isSecretary ? `Secretary · ${practice?.doctorName}` : undefined
				}
			/>
			<ul className={cn("font-medium text-sm", collapsed ? "px-1" : "px-2")}>
				{visible(items1).map((item) => (
					<li key={item.path}>
						<SidebarItem
							item={{
								...item,
								disabled: !canWork && item.path !== "/dashboard/profile",
							}}
							collapsed={collapsed}
						/>
					</li>
				))}
				<li>
					<div className="h-px my-2 bg-border" />
				</li>
				{visible(items2).map((item) => (
					<li key={item.path}>
						<SidebarItem
							item={{
								...item,
								disabled: !canWork && item.path !== "/dashboard/profile",
								badge:
									item.path === "/dashboard/subscription" && planBadge
										? planBadge
										: undefined,
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
	return (
		<AiPanelProvider>
			<SidebarShell>{children}</SidebarShell>
		</AiPanelProvider>
	);
}

function SidebarShell({ children }: { children: React.ReactNode }) {
	const { showMobileSidebar, setShowMobileSidebar, isMobile } = useAppContext();
	const { collapsed, ready, toggle } = useCollapsedState();
	const { docked } = useAiPanel();

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
					// Room for the docked AI panel (420px wide; the page keeps its own padding)
					docked && "xl:mr-[420px]",
				)}
			>
				<ReferralExclusionBanner />
				{children}
			</div>
		</>
	);
}
