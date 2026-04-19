"use client";

import useSWR from "swr";
import { useAuth } from "@/components/contexts/auth-provider";
import ApplicationStatus from "@/components/dashboard/application-status";
import { getMyDoctorApplication } from "@/services";
import { getMe } from "@/services/users";

export default function DashboardHome() {
	const { user } = useAuth();

	const { data: me } = useSWR(user ? "/api/users/me" : null, () => getMe());

	const { data: application } = useSWR(
		user ? "/api/doctor-applications/me" : null,
		() => getMyDoctorApplication().catch(() => null),
	);

	const profile = me?.doctorProfile ?? null;
	const status = profile?.status ?? application?.status ?? "none";

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
