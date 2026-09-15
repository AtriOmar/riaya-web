"use client";

import {
	CalendarClock,
	CalendarDays,
	CircleDollarSign,
	ClipboardList,
	FileWarning,
	Users,
} from "lucide-react";
import Link from "next/link";
import type { ComponentType } from "react";
import { ProPlanBadge } from "@/components/dashboard/subscription/pro-plan-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatTnd } from "@/lib/money";
import { cn } from "@/lib/utils";
import { useGetApiDashboardStats } from "@/services/generated/dashboard/dashboard";

function usagePercent(used: number, limit: number | null) {
	if (limit == null || limit <= 0) return 0;
	return Math.min(100, Math.round((used / limit) * 100));
}

function formatUsage(used: number, limit: number | null) {
	if (limit == null) return `${used} / ∞`;
	return `${used} / ${limit}`;
}

function statusVariant(
	status: string | null,
): "warning" | "success" | "destructive" | "secondary" {
	if (status === "pending") return "warning";
	if (status === "confirmed") return "success";
	if (status === "cancelled") return "destructive";
	return "secondary";
}

function StatCard({
	label,
	value,
	icon: Icon,
	href,
	color,
}: {
	label: string;
	value: string | number;
	icon: ComponentType<{ className?: string }>;
	href?: string;
	color: string;
}) {
	const body = (
		<Card className="py-4 h-full transition-colors hover:bg-muted/30">
			<CardHeader className="px-4 pt-0 pb-2">
				<CardTitle className="flex items-center gap-2 font-medium text-muted-foreground text-sm">
					<Icon className={cn("w-4 h-4", color)} />
					{label}
				</CardTitle>
			</CardHeader>
			<CardContent className="px-4 pb-0">
				<p className="font-bold text-2xl tabular-nums">{value}</p>
			</CardContent>
		</Card>
	);

	if (href) {
		return (
			<Link href={href} className="block focus-visible:outline-none">
				{body}
			</Link>
		);
	}
	return body;
}

function UsageBar({
	label,
	used,
	limit,
}: {
	label: string;
	used: number;
	limit: number | null;
}) {
	const pct = usagePercent(used, limit);
	const nearLimit = limit != null && pct >= 80;

	return (
		<div className="space-y-2">
			<div className="flex items-center justify-between gap-3 text-sm">
				<span className="text-muted-foreground">{label}</span>
				<span
					className={cn(
						"font-medium tabular-nums",
						nearLimit && "text-amber-700",
					)}
				>
					{formatUsage(used, limit)}
				</span>
			</div>
			<div className="h-2 overflow-hidden rounded-full bg-muted">
				<div
					className={cn(
						"h-full rounded-full transition-all",
						nearLimit ? "bg-amber-500" : "bg-primary",
						limit == null && "bg-chart-2",
					)}
					style={{ width: limit == null ? "12%" : `${Math.max(pct, 2)}%` }}
				/>
			</div>
		</div>
	);
}

function AppointmentsChart({
	data,
}: {
	data: { date: string; total: number; ai: number; dashboard: number }[];
}) {
	const max = Math.max(1, ...data.map((d) => d.total));

	return (
		<div className="space-y-3">
			<div className="flex items-end gap-1.5 h-40">
				{data.map((day) => {
					const height = Math.max(4, Math.round((day.total / max) * 100));
					const label = new Date(`${day.date}T12:00:00`).toLocaleDateString(
						"en-GB",
						{ day: "numeric", month: "short" },
					);
					return (
						<div
							key={day.date}
							className="group flex flex-1 flex-col items-center gap-1 min-w-0"
						>
							<span className="text-[10px] tabular-nums text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
								{day.total}
							</span>
							<div className="flex w-full flex-1 items-end">
								<div
									className="relative mx-auto w-full max-w-6 overflow-hidden rounded-t-sm bg-muted"
									style={{ height: `${height}%` }}
									title={`${label}: ${day.total} (${day.ai} AI, ${day.dashboard} dashboard)`}
								>
									<div
										className="absolute inset-x-0 bottom-0 bg-primary"
										style={{
											height:
												day.total > 0
													? `${Math.round((day.dashboard / day.total) * 100)}%`
													: "0%",
										}}
									/>
									<div
										className="absolute inset-x-0 top-0 bg-chart-2"
										style={{
											height:
												day.total > 0
													? `${Math.round((day.ai / day.total) * 100)}%`
													: "0%",
										}}
									/>
								</div>
							</div>
							<span className="w-full truncate text-center text-[10px] text-muted-foreground">
								{label}
							</span>
						</div>
					);
				})}
			</div>
			<div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
				<span className="inline-flex items-center gap-1.5">
					<span className="size-2.5 rounded-sm bg-primary" />
					Dashboard
				</span>
				<span className="inline-flex items-center gap-1.5">
					<span className="size-2.5 rounded-sm bg-chart-2" />
					AI phone
				</span>
			</div>
		</div>
	);
}

function BreakdownBars({
	items,
	colorFor,
}: {
	items: { key: string; label: string; count: number }[];
	colorFor: (key: string) => string;
}) {
	const max = Math.max(1, ...items.map((i) => i.count));
	if (items.length === 0) {
		return (
			<p className="text-sm text-muted-foreground py-6 text-center">
				No data yet
			</p>
		);
	}

	return (
		<div className="space-y-3">
			{items.map((item) => (
				<div key={item.key} className="space-y-1.5">
					<div className="flex items-center justify-between text-sm">
						<span className="capitalize text-muted-foreground">
							{item.label}
						</span>
						<span className="font-medium tabular-nums">{item.count}</span>
					</div>
					<div className="h-2 overflow-hidden rounded-full bg-muted">
						<div
							className={cn("h-full rounded-full", colorFor(item.key))}
							style={{
								width: `${Math.max(4, Math.round((item.count / max) * 100))}%`,
							}}
						/>
					</div>
				</div>
			))}
		</div>
	);
}

function DashboardSkeleton() {
	return (
		<div className="space-y-6">
			<div className="gap-3 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
				{(
					[
						"stat-1",
						"stat-2",
						"stat-3",
						"stat-4",
						"stat-5",
						"stat-6",
						"stat-7",
					] as const
				).map((id) => (
					<Skeleton key={id} className="h-24 rounded-xl" />
				))}
			</div>
			<div className="grid gap-4 lg:grid-cols-3">
				<Skeleton className="h-64 rounded-xl lg:col-span-2" />
				<Skeleton className="h-64 rounded-xl" />
			</div>
			<div className="grid gap-4 lg:grid-cols-2">
				<Skeleton className="h-56 rounded-xl" />
				<Skeleton className="h-56 rounded-xl" />
			</div>
		</div>
	);
}

export default function DoctorDashboardHome() {
	const { data, isLoading, error } = useGetApiDashboardStats();

	if (isLoading) return <DashboardSkeleton />;

	if (error || !data) {
		return (
			<Card className="py-10">
				<CardContent className="text-center text-muted-foreground">
					Could not load dashboard stats. Please refresh.
				</CardContent>
			</Card>
		);
	}

	const resetsOn = data.plan.usagePeriod.end
		? new Date(data.plan.usagePeriod.end).toLocaleDateString("en-GB", {
				day: "numeric",
				month: "long",
				year: "numeric",
			})
		: null;

	const statusItems = data.charts.appointmentsByStatus.map((s) => ({
		key: s.status,
		label: s.status.replaceAll("_", " "),
		count: s.count,
	}));

	const sourceItems = data.charts.appointmentsBySource.map((s) => ({
		key: s.source,
		label: s.source === "ai" ? "AI phone" : s.source,
		count: s.count,
	}));

	return (
		<div className="space-y-6">
			<section>
				<h4 className="mb-3 font-semibold text-lg">Overview</h4>
				<div className="gap-3 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
					<StatCard
						label="Patients"
						value={data.counts.patients}
						icon={Users}
						href="/dashboard/patients"
						color="text-primary"
					/>
					<StatCard
						label="Today"
						value={data.counts.appointmentsToday}
						icon={CalendarDays}
						href="/dashboard/appointments"
						color="text-sky-600"
					/>
					<StatCard
						label="Next 7 days"
						value={data.counts.appointmentsThisWeek}
						icon={CalendarClock}
						href="/dashboard/appointments"
						color="text-violet-600"
					/>
					<StatCard
						label="Pending"
						value={data.counts.pendingAppointments}
						icon={ClipboardList}
						href="/dashboard/appointments"
						color="text-amber-600"
					/>
					<StatCard
						label="Collected"
						value={formatTnd(data.revenue.collectedThisMonth)}
						icon={CircleDollarSign}
						href="/dashboard/invoices"
						color="text-green-600"
					/>
					<StatCard
						label="Outstanding"
						value={formatTnd(data.revenue.outstanding)}
						icon={CircleDollarSign}
						href="/dashboard/invoices"
						color="text-red-500"
					/>
					<StatCard
						label="Unpaid invoices"
						value={data.counts.unpaidInvoices}
						icon={FileWarning}
						href="/dashboard/invoices"
						color="text-orange-600"
					/>
				</div>
			</section>

			<section className="grid gap-4 lg:grid-cols-3">
				<Card className="lg:col-span-2">
					<CardHeader className="pb-2">
						<CardTitle className="text-base">
							Appointments · last 14 days
						</CardTitle>
					</CardHeader>
					<CardContent>
						<AppointmentsChart data={data.charts.appointmentsByDay} />
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="pb-2">
						<div className="flex items-center justify-between gap-2">
							<CardTitle className="text-base">Plan usage</CardTitle>
							{data.plan.isPro ? (
								<ProPlanBadge compact />
							) : (
								<Badge variant="secondary">Free</Badge>
							)}
						</div>
						{resetsOn && (
							<p className="text-xs text-muted-foreground">Resets {resetsOn}</p>
						)}
					</CardHeader>
					<CardContent className="space-y-5">
						<UsageBar
							label="AI booking patients"
							used={data.plan.usage.aiBookingPatients}
							limit={data.plan.limits.aiBookingPatients}
						/>
						<UsageBar
							label="WhatsApp sends"
							used={data.plan.usage.whatsappSendsThisMonth}
							limit={data.plan.limits.whatsappSendsPerMonth}
						/>
						<UsageBar
							label="Conversation recordings"
							used={data.plan.usage.recordingsThisMonth}
							limit={data.plan.limits.recordingsPerMonth}
						/>
						<UsageBar
							label="AI assistant messages"
							used={data.plan.usage.aiMessagesThisMonth}
							limit={data.plan.limits.aiMessagesPerMonth}
						/>
						{!data.plan.isPro && (
							<Button asChild variant="outline" size="sm" className="w-full">
								<Link href="/dashboard/subscription">Upgrade to Pro</Link>
							</Button>
						)}
					</CardContent>
				</Card>
			</section>

			<section className="grid gap-4 lg:grid-cols-2">
				<Card>
					<CardHeader className="pb-2">
						<div className="flex items-center justify-between gap-2">
							<CardTitle className="text-base">
								Upcoming
								{data.counts.upcomingAppointments > 0 && (
									<span className="ml-2 font-normal text-muted-foreground text-sm tabular-nums">
										({data.counts.upcomingAppointments})
									</span>
								)}
							</CardTitle>
							<Button asChild variant="ghost" size="sm">
								<Link href="/dashboard/appointments">View all</Link>
							</Button>
						</div>
					</CardHeader>
					<CardContent>
						{data.upcoming.length === 0 ? (
							<p className="py-8 text-center text-sm text-muted-foreground">
								No upcoming appointments.{" "}
								<Link
									href="/dashboard/appointments"
									className="text-primary underline-offset-2 hover:underline"
								>
									Open calendar
								</Link>
							</p>
						) : (
							<ul className="divide-y">
								{data.upcoming.map((a) => (
									<li
										key={a.id}
										className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
									>
										<div className="min-w-0">
											<p className="truncate font-medium">{a.patientName}</p>
											<p className="text-xs text-muted-foreground truncate">
												{a.name ?? "Appointment"}
												{a.source === "ai" ? " · AI" : ""}
											</p>
										</div>
										<div className="shrink-0 text-right space-y-1">
											<p className="text-xs tabular-nums text-muted-foreground">
												{a.start
													? new Date(a.start).toLocaleString("en-GB", {
															day: "numeric",
															month: "short",
															hour: "2-digit",
															minute: "2-digit",
														})
													: "—"}
											</p>
											<Badge variant={statusVariant(a.status)}>
												{a.status ?? "—"}
											</Badge>
										</div>
									</li>
								))}
							</ul>
						)}
					</CardContent>
				</Card>

				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
					<Card>
						<CardHeader className="pb-2">
							<CardTitle className="text-base">By status</CardTitle>
						</CardHeader>
						<CardContent>
							<BreakdownBars
								items={statusItems}
								colorFor={(key) => {
									if (key === "confirmed") return "bg-green-500";
									if (key === "pending") return "bg-amber-500";
									if (key === "cancelled") return "bg-red-400";
									return "bg-primary";
								}}
							/>
						</CardContent>
					</Card>
					<Card>
						<CardHeader className="pb-2">
							<CardTitle className="text-base">By source</CardTitle>
						</CardHeader>
						<CardContent>
							<BreakdownBars
								items={sourceItems}
								colorFor={(key) => (key === "ai" ? "bg-chart-2" : "bg-primary")}
							/>
						</CardContent>
					</Card>
				</div>
			</section>
		</div>
	);
}
