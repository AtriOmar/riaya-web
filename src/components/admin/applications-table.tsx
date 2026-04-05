"use client";

import { useRouter } from "next/navigation";
import useSWR from "swr";
import DataTable, { type Column } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
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
	const { data: applications } = useSWR(
		"admin-applications",
		getDoctorApplications,
	);

	return (
		<div className="mt-6">
			<h4 className="mb-3 font-semibold text-lg">Doctor Applications</h4>
			<DataTable
				columns={columns}
				data={applications ?? []}
				keyExtractor={(row) => row.id}
				onRowClick={(row) =>
					router.push(`/admin/doctor-applications/${row.id}`)
				}
				emptyMessage="No applications found."
			/>
		</div>
	);
}
