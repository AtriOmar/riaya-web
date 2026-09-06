"use client";

import { Skeleton } from "@/components/ui/skeleton";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

const SKELETON_ROW_KEYS = [
	"sk-1",
	"sk-2",
	"sk-3",
	"sk-4",
	"sk-5",
	"sk-6",
	"sk-7",
	"sk-8",
	"sk-9",
	"sk-10",
	"sk-11",
	"sk-12",
] as const;

export type Column<T> = {
	key: string;
	header: string;
	cell: (row: T) => React.ReactNode;
	className?: string;
	skeleton?: React.ReactNode;
};

type DataTableProps<T> = {
	columns: Column<T>[];
	data: T[];
	keyExtractor: (row: T) => string | number;
	onRowClick?: (row: T) => void;
	emptyMessage?: React.ReactNode;
	className?: string;
	isLoading?: boolean;
	skeletonRows?: number;
};

export default function DataTable<T>({
	columns,
	data,
	keyExtractor,
	onRowClick,
	emptyMessage = "No data found.",
	className,
	isLoading = false,
	skeletonRows = 8,
}: DataTableProps<T>) {
	return (
		<div
			className={cn(
				"overflow-hidden border border-border rounded-md bg-card",
				className,
			)}
			aria-busy={isLoading}
		>
			<Table>
				<TableHeader>
					<TableRow className="hover:bg-transparent border-b">
						{columns.map((col) => (
							<TableHead
								key={col.key}
								className={cn(
									"h-11 px-4 text-sm font-medium text-muted-foreground",
									col.className,
								)}
							>
								{col.header}
							</TableHead>
						))}
					</TableRow>
				</TableHeader>
				<TableBody>
					{isLoading ? (
						SKELETON_ROW_KEYS.slice(0, skeletonRows).map((rowKey) => (
							<TableRow
								key={rowKey}
								className="hover:bg-transparent"
								aria-hidden
							>
								{columns.map((col) => (
									<TableCell
										key={col.key}
										className={cn("px-4 py-3", col.className)}
									>
										{col.skeleton ?? <Skeleton className="h-4 w-3/4" />}
									</TableCell>
								))}
							</TableRow>
						))
					) : data.length === 0 ? (
						<TableRow>
							<TableCell
								colSpan={columns.length}
								className="h-32 text-muted-foreground text-center"
							>
								{emptyMessage}
							</TableCell>
						</TableRow>
					) : (
						data.map((row) => (
							<TableRow
								key={keyExtractor(row)}
								onClick={() => onRowClick?.(row)}
								className={cn(
									"transition-colors",
									onRowClick && "cursor-pointer hover:bg-muted/40",
								)}
							>
								{columns.map((col) => (
									<TableCell
										key={col.key}
										className={cn("px-4 py-3", col.className)}
									>
										{col.cell(row)}
									</TableCell>
								))}
							</TableRow>
						))
					)}
				</TableBody>
			</Table>
		</div>
	);
}
