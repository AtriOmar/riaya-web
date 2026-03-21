"use client";

import { useParams } from "next/navigation";
import UserDetail from "@/components/admin/user-detail";

export default function AdminUserPage() {
  const params = useParams<{ id: string }>();

  return (
    <div className="pr-2 md:pr-10 pb-20 pl-2">
      <h3 className="mb-4 font-bold text-2xl">User Details</h3>
      <UserDetail userId={params.id} />
    </div>
  );
}
