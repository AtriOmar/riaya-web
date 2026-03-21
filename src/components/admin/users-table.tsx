"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import useSWR from "swr";
import DataTable, { type Column } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { getUsers } from "@/services";
import type { UserRow } from "@/services/types";

const ROLES: Record<number, string> = { 1: "Doctor", 3: "Admin", 5: "Owner" };

const columns: Column<UserRow>[] = [
  {
    key: "email",
    header: "Email",
    cell: (row) => (
      <div className="flex items-center gap-2">
        <span>{row.email}</span>
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
  const [search, setSearch] = useState("");
  const { data: users } = useSWR(["admin-users", search], () =>
    getUsers({ search }),
  );

  return (
    <div>
      <Input
        placeholder="Search by email or name..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm mb-4"
      />
      <DataTable
        columns={columns}
        data={users ?? []}
        keyExtractor={(row) => row.id}
        onRowClick={(row) => router.push(`/admin/users/${row.id}`)}
        emptyMessage="No users found."
      />
    </div>
  );
}
