"use client";

import useSWR from "swr";
import ApplicationStatus from "@/components/dashboard/application-status";
import { useAuth } from "@/contexts/auth-provider";
import { getMyDoctorApplication } from "@/services";

export default function DashboardHome() {
	const { user } = useAuth();

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
