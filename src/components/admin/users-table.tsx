"use client";

import { Copy, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import useSWRInfinite from "swr/infinite";
import DataTable, { type Column } from "@/components/data-table";
import InfiniteScrollTrigger from "@/components/infinite-scroll-trigger";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useDebounce } from "@/hooks/use-debounce";
import { getUsers } from "@/services";
import type { UserRow } from "@/services/types";

const ROLES: Record<number, string> = { 1: "Doctor", 3: "Admin", 5: "Owner" };

const columns: Column<UserRow>[] = [
	{
		key: "user",
		header: "User",
		cell: (row) => (
			<div className="flex items-center gap-3">
				<Avatar className="w-8 h-8">
					<AvatarImage src={row.image ?? undefined} />
					<AvatarFallback>
						{(row.displayName ?? row.name ?? row.email).charAt(0).toUpperCase()}
					</AvatarFallback>
				</Avatar>
				<div className="flex items-center gap-2">
					<span className="font-medium">{row.email}</span>
					<button
						type="button"
						onClick={(e) => {
							e.stopPropagation();
							navigator.clipboard.writeText(row.email);
							toast.success("Email copied to clipboard");
						}}
						className="text-muted-foreground hover:text-foreground transition-colors"
						title="Copy email"
					>
						<Copy className="w-3 h-3" />
					</button>
					{row.accessId && row.accessId >= 3 && (
						<Badge variant="outline" className="text-[10px]">
							{ROLES[row.accessId] ?? "Admin"}
						</Badge>
					)}
					{row.active === 0 && (
						<Badge variant="destructive" className="text-[10px]">
							Banned
						</Badge>
					)}
				</div>
			</div>
		),
	},
	{
		key: "name",
		header: "Name",
		cell: (row) => row.displayName ?? row.name ?? "—",
	},
	{ key: "username", header: "Username", cell: (row) => row.username ?? "—" },
	{
		key: "created",
		header: "Joined",
		cell: (row) =>
			row.createdAt
				? new Date(row.createdAt).toLocaleDateString("en-GB", {
						year: "numeric",
						month: "short",
						day: "2-digit",
					})
				: "—",
	},
];

export default function UsersTable() {
	const router = useRouter();
	const [inputValue, setInputValue] = useState("");
	const search = useDebounce(inputValue, 300);
	const limit = 20;

	const getKey = (pageIndex: number, previousPageData: UserRow[] | null) => {
		if (previousPageData && !previousPageData.length) return null; // reached the end
		return ["admin-users", search, pageIndex + 1]; // SWR key
	};

	const { data, size, setSize, isValidating } = useSWRInfinite(
		getKey,
		([, search, page]) =>
			getUsers({ search: search as string, page: page as number, limit }),
	);

	const users = data ? data.flat() : [];
	const isLoadingMore =
		isValidating ||
		(size > 0 && !!data && typeof data[size - 1] === "undefined");
	const isEmpty = data?.[0]?.length === 0;
	const isReachingEnd =
		isEmpty || (data && data[data.length - 1]?.length < limit);

	return (
		<div>
			<div className="relative mb-3 max-w-sm">
				<Search className="top-1/2 left-3 absolute w-4 h-4 text-muted-foreground -translate-y-1/2" />
				<Input
					placeholder="Search by email or name..."
					value={inputValue}
					onChange={(e) => setInputValue(e.target.value)}
					className="bg-card pl-9 border-border rounded-sm"
				/>
			</div>
			<DataTable
				columns={columns}
				data={users}
				keyExtractor={(row) => row.id}
				onRowClick={(row) => router.push(`/admin/users/${row.id}`)}
				emptyMessage="No users found."
			/>
			<InfiniteScrollTrigger
				onLoadMore={() => setSize(size + 1)}
				isLoading={isLoadingMore}
				hasMore={!isReachingEnd}
			/>
		</div>
	);
}
