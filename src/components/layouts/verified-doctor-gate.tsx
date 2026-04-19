"use client";

import { Loader2 } from "lucide-react";
import { usePathname } from "next/navigation";
import useSWR from "swr";
import { useAuth } from "@/components/contexts/auth-provider";
import ApplicationStatus from "@/components/dashboard/application-status";
import { getMyDoctorApplication } from "@/services";
import { getMe } from "@/services/users";

/** Matches each verified-route page heading so the title still shows when the gate blocks content. */
function titleForVerifiedPath(pathname: string): string {
	if (pathname === "/dashboard/appointments") return "Appointments";
	if (pathname === "/dashboard/availability") return "Availability";
	if (pathname === "/dashboard/settings") return "Settings";
	if (pathname === "/dashboard/patients/new") return "New Patient";
	if (pathname === "/dashboard/patients") return "Patients";
	if (
		pathname.startsWith("/dashboard/patients/") &&
		pathname !== "/dashboard/patients/new"
	) {
		return "Patient Details";
	}
	return "Dashboard";
}

/**
 * Restricts children to doctors with a verified doctor profile (`doctor_profile.status === "verified"`).
 * Onboarding stays on `/dashboard` and `/dashboard/profile`; blocked state uses `ApplicationStatus` (same card as dashboard, including the “none” look).
 */
export default function VerifiedDoctorGate({
	children,
}: {
	children: React.ReactNode;
}) {
	const pathname = usePathname();
	const { user } = useAuth();
	const { data: me, isLoading } = useSWR(user ? "/api/users/me" : null, () =>
		getMe(),
	);

	const { data: application } = useSWR(
		user ? "/api/doctor-applications/me" : null,
		() => getMyDoctorApplication().catch(() => null),
	);

	if (!user) {
		return null;
	}

	if (isLoading || !me) {
		return (
			<div className="flex justify-center items-center min-h-[40vh]">
				<Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
			</div>
		);
	}

	const profile = me.doctorProfile;
	const isVerified = profile?.status === "verified";

	if (!isVerified) {
		const raw = profile?.status ?? application?.status ?? "none";
		const status = raw === "verified" ? "none" : raw;

		const pageTitle = titleForVerifiedPath(pathname);

		return (
			<div className="pr-2 md:pr-10 pb-20 pl-2">
				<h3 className="font-bold text-2xl">{pageTitle}</h3>
				<ApplicationStatus
					status={status}
					rejectionReasons={application?.rejectionReasons}
				/>
			</div>
		);
	}

	return <>{children}</>;
}
