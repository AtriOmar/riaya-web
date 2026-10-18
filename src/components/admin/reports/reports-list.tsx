"use client";

import { formatDistanceToNow } from "date-fns";
import { Inbox } from "lucide-react";
import { useState } from "react";
import DataTable, { type Column } from "@/components/data-table";
import { FilterSegmented } from "@/components/ui/filter-controls";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPhoneDisplay } from "@/lib/phone";
import { useGetApiCallReports } from "@/services/generated/abuse/abuse";
import type {
	GetApiCallReports200Item,
	GetApiCallReportsStatus,
} from "@/services/generated/api.schemas";
import { ordinal } from "./report-labels";
import ReportSheet, { CategoryBadge } from "./report-sheet";

const STATUS_LABELS: Record<string, string> = {
	dismissed: "Dismissed",
	blocked: "Blocked",
};

function columns(
	status: GetApiCallReportsStatus,
): Column<GetApiCallReports200Item>[] {
	return [
		{
			key: "number",
			header: "Number",
			skeleton: <Skeleton className="h-4 w-32" />,
			cell: (row) => (
				<div className="flex flex-col gap-0.5">
					<span className="font-medium whitespace-nowrap">
						{formatPhoneDisplay(row.phoneNumber)}
					</span>
					<span className="text-muted-foreground text-xs">
						{ordinal(row.number.reportCount)} report
						{row.number.blocked && " · blocked"}
					</span>
				</div>
			),
		},
		{
			key: "category",
			header: "Reason",
			skeleton: <Skeleton className="h-5 w-16 rounded-full" />,
			cell: (row) => <CategoryBadge category={row.category} />,
		},
		{
			key: "summary",
			header: "What the AI saw",
			skeleton: <Skeleton className="h-4 w-56" />,
			cell: (row) => (
				<p className="line-clamp-2 max-w-md text-muted-foreground text-sm">
					{row.summary}
				</p>
			),
		},
		...(status === "reviewed"
			? [
					{
						key: "status",
						header: "Outcome",
						skeleton: <Skeleton className="h-4 w-16" />,
						cell: (row: GetApiCallReports200Item) =>
							STATUS_LABELS[row.status] ?? row.status,
					},
				]
			: []),
		{
			key: "when",
			header: "Reported",
			skeleton: <Skeleton className="h-4 w-20" />,
			cell: (row) => (
				<span className="whitespace-nowrap text-muted-foreground text-sm">
					{formatDistanceToNow(new Date(row.createdAt), { addSuffix: true })}
				</span>
			),
		},
	];
}

export default function ReportsList() {
	const [status, setStatus] = useState<GetApiCallReportsStatus>("open");
	const [selectedId, setSelectedId] = useState<number | null>(null);
	const { data, isLoading } = useGetApiCallReports({ status });

	return (
		<div>
			<div className="mb-4 flex flex-wrap items-center gap-2">
				<FilterSegmented
					value={status}
					onChange={setStatus}
					options={[
						{ value: "open", label: "To review" },
						{ value: "reviewed", label: "Reviewed" },
					]}
				/>
			</div>
			<DataTable
				columns={columns(status)}
				data={data ?? []}
				isLoading={isLoading}
				skeletonRows={4}
				keyExtractor={(row) => row.id}
				onRowClick={(row) => setSelectedId(row.id)}
				emptyMessage={
					<div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
						<Inbox className="mb-4 size-12 opacity-50" />
						<span className="font-semibold text-foreground">
							{status === "open"
								? "Nothing to review"
								: "No reviewed reports yet"}
						</span>
						<span className="mt-1 max-w-sm text-center text-sm">
							The AI files a report when a caller mocks it, insults it, or makes
							threats. Reports show up here for you to review.
						</span>
					</div>
				}
			/>
			<ReportSheet
				reportId={selectedId}
				onOpenChange={(open) => {
					if (!open) setSelectedId(null);
				}}
			/>
		</div>
	);
}
