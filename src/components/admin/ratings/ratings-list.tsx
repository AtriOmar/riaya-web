"use client";

import { format, isThisYear } from "date-fns";
import { ArrowUpDown, Inbox } from "lucide-react";
import { useState } from "react";
import DataTable, { type Column } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { FilterSelect } from "@/components/ui/filter-controls";
import { Skeleton } from "@/components/ui/skeleton";
import type {
	GetApiDoctorRatings200Item,
	GetApiDoctorRatingsSort,
} from "@/services/generated/api.schemas";
import { useGetApiDoctorRatings } from "@/services/generated/ratings/ratings";
import {
	DoctorAvatar,
	formatLongWaits,
	formatRating,
	isPoorAverage,
	RatingValue,
	recentCaption,
	tooFewCaption,
} from "./rating-labels";
import RatingSheet from "./rating-sheet";

/** "8 Oct" this year, "8 Oct 2025" before. */
function shortDate(iso: string) {
	const date = new Date(iso);
	return format(date, isThisYear(date) ? "d MMM" : "d MMM yyyy");
}

const numeric = "w-px whitespace-nowrap px-3";

const columns: Column<GetApiDoctorRatings200Item>[] = [
	{
		key: "doctor",
		header: "Doctor",
		// Takes the width left over by the other columns and truncates to it.
		className: "w-full max-w-0 min-w-60",
		skeleton: (
			<div className="flex items-center gap-3">
				<Skeleton className="size-8 rounded-full" />
				<Skeleton className="h-4 w-40" />
			</div>
		),
		cell: (row) => {
			const subtitle = [row.speciality, row.cabinetName]
				.filter(Boolean)
				.join(" · ");
			return (
				<div className="flex items-center gap-3">
					<DoctorAvatar doctor={row} className="shrink-0" />
					<div className="flex min-w-0 flex-col gap-0.5">
						<span className="truncate font-medium">Dr {row.name || "—"}</span>
						{subtitle && (
							<span
								className="truncate text-muted-foreground text-xs"
								title={subtitle}
							>
								{subtitle}
							</span>
						)}
					</div>
				</div>
			);
		},
	},
	{
		key: "average",
		header: "Average",
		className: numeric,
		skeleton: <Skeleton className="h-4 w-10" />,
		cell: (row) => (
			<RatingValue
				value={formatRating(row.averageRating)}
				basedOn={row.reviewCount}
				danger={isPoorAverage(row)}
			/>
		),
	},
	{
		key: "recent",
		header: "Last 90 days",
		className: numeric,
		skeleton: <Skeleton className="h-4 w-10" />,
		cell: (row) => (
			<RatingValue
				value={formatRating(row.last90DaysAverage)}
				basedOn={row.reviewCount90d}
				caption={recentCaption(row)}
			/>
		),
	},
	{
		key: "reviews",
		header: "Reviews",
		className: numeric,
		skeleton: <Skeleton className="h-4 w-8" />,
		cell: (row) => (
			<RatingValue
				value={row.reviewCount}
				basedOn={row.reviewCount}
				caption={tooFewCaption(row.reviewCount)}
			/>
		),
	},
	{
		key: "longWait",
		header: "Long waits",
		className: numeric,
		skeleton: <Skeleton className="h-4 w-10" />,
		cell: (row) => (
			<RatingValue value={formatLongWaits(row)} basedOn={row.waitCount} />
		),
	},
	{
		key: "lowRating",
		header: "Latest low rating",
		className: numeric,
		skeleton: <Skeleton className="h-4 w-14" />,
		cell: (row) => (
			<span className="text-muted-foreground text-sm">
				{row.latestLowRatingAt ? shortDate(row.latestLowRatingAt) : "—"}
			</span>
		),
	},
	{
		key: "referrals",
		header: "Referrals",
		className: numeric,
		skeleton: <Skeleton className="h-5 w-16 rounded-full" />,
		cell: (row) =>
			row.exclusion ? (
				<Badge variant="destructive">Excluded</Badge>
			) : (
				<Badge variant="success">Listed</Badge>
			),
	},
];

export default function RatingsList() {
	const [sort, setSort] = useState<GetApiDoctorRatingsSort>("average_asc");
	const [selectedId, setSelectedId] = useState<number | null>(null);
	const { data, isLoading } = useGetApiDoctorRatings({ sort });

	return (
		<div>
			<div className="mb-4 flex flex-wrap items-center gap-2">
				<FilterSelect
					icon={ArrowUpDown}
					label="Sort by"
					value={sort}
					onValueChange={(v) => setSort(v as GetApiDoctorRatingsSort)}
					options={[
						{ value: "average_asc", label: "Lowest average" },
						{ value: "average_desc", label: "Highest average" },
						{ value: "reviews_desc", label: "Most reviews" },
						{ value: "latest_low_desc", label: "Latest low rating" },
					]}
				/>
			</div>
			<DataTable
				columns={columns}
				data={data ?? []}
				isLoading={isLoading}
				skeletonRows={5}
				keyExtractor={(row) => row.doctorId}
				onRowClick={(row) => setSelectedId(row.doctorId)}
				rowClassName={(row) =>
					isPoorAverage(row) ? "bg-destructive/5" : undefined
				}
				emptyMessage={
					<div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
						<Inbox className="mb-4 size-12 opacity-50" />
						<span className="font-semibold text-foreground">
							No ratings yet
						</span>
						<span className="mt-1 max-w-sm text-center text-sm">
							Patients get a review request on WhatsApp after a confirmed visit.
							Doctors show up here once someone answers.
						</span>
					</div>
				}
			/>
			<RatingSheet
				doctorId={selectedId}
				onOpenChange={(open) => {
					if (!open) setSelectedId(null);
				}}
			/>
		</div>
	);
}
