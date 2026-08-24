"use client";

import { Inbox, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import useSWRInfinite from "swr/infinite";
import DataTable, { type Column } from "@/components/data-table";
import InfiniteScrollTrigger from "@/components/infinite-scroll-trigger";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { useDebounce } from "@/hooks/use-debounce";
import { getDoctorApplications } from "@/services";
import type { DoctorApplicationSummary } from "@/services/types";

const columns: Column<DoctorApplicationSummary>[] = [
	{ key: "email", header: "Email", cell: (row) => row.user?.email ?? "—" },
	{ key: "firstName", header: "First Name", cell: (row) => row.firstName },
	{ key: "lastName", header: "Last Name", cell: (row) => row.lastName },
	{
		key: "status",
		header: "Status",
		cell: (row) => (
			<Badge
				variant={
					row.status === "pending"
						? "secondary"
						: row.status === "verified"
							? "default"
							: "destructive"
				}
			>
				{row.status}
			</Badge>
		),
	},
	{
		key: "date",
		header: "Date",
		cell: (row) =>
			row.createdAt
				? new Date(row.createdAt).toLocaleDateString("en-GB", {
						year: "numeric",
						month: "2-digit",
						day: "2-digit",
					})
				: "—",
	},
];

export default function ApplicationsTable() {
	const router = useRouter();
	const [statusFilter, setStatusFilter] = useState("pending");
	const [inputValue, setInputValue] = useState("");
	const search = useDebounce(inputValue, 300);
	const limit = 20;

	const getKey = (
		pageIndex: number,
		previousPageData: DoctorApplicationSummary[] | null,
	) => {
		if (previousPageData && !previousPageData.length) return null;
		return ["admin-applications", statusFilter, search, pageIndex + 1];
	};

	const { data, size, setSize, isValidating } = useSWRInfinite(
		getKey,
		([, status, search, page]) =>
			getDoctorApplications({
				status: status as string,
				search: search as string,
				page: page as number,
				limit,
			}),
	);

	const applications = data ? data.flat() : [];
	const isLoadingMore =
		isValidating ||
		(size > 0 && !!data && typeof data[size - 1] === "undefined");
	const isEmpty = data?.[0]?.length === 0;
	const isReachingEnd =
		isEmpty || (data && data[data.length - 1]?.length < limit);

	return (
		<div className="space-y-4">
			<div className="flex gap-4">
				<div className="relative w-full max-w-sm">
					<Search className="top-1/2 left-3 absolute w-4 h-4 text-muted-foreground -translate-y-1/2" />
					<Input
						placeholder="Search by email or name..."
						value={inputValue}
						onChange={(e) => setInputValue(e.target.value)}
						className="bg-card pl-9 border-border rounded-sm"
					/>
				</div>
				<Select value={statusFilter} onValueChange={setStatusFilter}>
					<SelectTrigger className="rounded-sm w-[180px]">
						<SelectValue placeholder="Filter by status" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">All</SelectItem>
						<SelectItem value="pending">Pending</SelectItem>
						<SelectItem value="verified">Verified</SelectItem>
						<SelectItem value="rejected">Rejected</SelectItem>
					</SelectContent>
				</Select>
			</div>
			<DataTable
				columns={columns}
				data={applications}
				keyExtractor={(row) => String(row.id)}
				onRowClick={(row) =>
					router.push(`/admin/doctor-applications/${row.id}`)
				}
				emptyMessage={
					<div className="flex flex-col justify-center items-center py-6 text-muted-foreground">
						<Inbox className="opacity-50 mb-4 w-12 h-12" />
						<span className="font-semibold text-foreground">
							No applications found
						</span>
						<span className="mt-1 text-sm">
							Try adjusting your filters or search terms
						</span>
					</div>
				}
			/>
			<InfiniteScrollTrigger
				onLoadMore={() => setSize(size + 1)}
				isLoading={isLoadingMore}
				hasMore={!isReachingEnd}
			/>
		</div>
	);
}
