"use client";

import useSWR from "swr";
import ApplicationStatus from "@/components/dashboard/application-status";
import { authClient } from "@/lib/auth-client";
import { getMyDoctorApplication } from "@/services";

export default function DashboardHome() {
  const { data: session } = authClient.useSession();
  const user = session?.user;

  const { data: application } = useSWR(
    user ? "/api/doctor-applications/me" : null,
    () => getMyDoctorApplication(),
  );

  const status = application?.status ?? "none";

  return (
    <div className="pr-2 md:pr-10 pb-20 pl-2">
      <h3 className="font-bold text-2xl">Dashboard</h3>
      <ApplicationStatus
        status={status}
        rejectionReasons={application?.rejectionReasons}
      />
    </div>
  );
}
