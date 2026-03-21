"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import DataTable, { type Column } from "@/components/data-table";
import { CubeLoader } from "@/components/loaders";
import { Button } from "@/components/ui/button";
import { getPatients } from "@/services";
import type { PatientSummary } from "@/services/types";

const columns: Column<PatientSummary>[] = [
  { key: "cin", header: "CIN", cell: (row) => row.cin },
  { key: "firstName", header: "First Name", cell: (row) => row.firstName },
  { key: "lastName", header: "Last Name", cell: (row) => row.lastName },
  {
    key: "dateOfBirth",
    header: "Date of Birth",
    cell: (row) =>
      row.dateOfBirth
        ? new Date(row.dateOfBirth).toLocaleDateString("en-GB", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          })
        : "—",
  },
];

export default function PatientsList() {
  const router = useRouter();
  const { data: patients, isLoading } = useSWR("patients", () => getPatients());

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <CubeLoader />
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-bold text-2xl">Patients</h3>
        <Button asChild>
          <Link href="/dashboard/patients/new">
            <Plus className="w-4 h-4" />
            New Patient
          </Link>
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={patients ?? []}
        keyExtractor={(row) => row.id}
        onRowClick={(row) => router.push(`/dashboard/patients/${row.id}`)}
        emptyMessage="No patients found."
      />
    </div>
  );
}
