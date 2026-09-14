"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/components/contexts/auth-provider";
import DoctorDashboardHome from "@/components/dashboard/home/doctor-dashboard-home";
import DashboardLayout from "@/components/layouts/dashboard-layout";
import { useGetApiUsersMe } from "@/services/generated/users/users";

export default function DashboardHome() {
	const { user } = useAuth();
	const router = useRouter();

	const { data: me, isLoading } = useGetApiUsersMe({
		swr: { enabled: !!user },
	});

	const isVerified = me?.doctorProfile?.status === "verified";

	useEffect(() => {
		if (!isLoading && me && !isVerified) {
			router.replace("/dashboard/profile");
		}
	}, [isLoading, me, isVerified, router]);

	if (!isVerified) {
		return null;
	}

	return (
		<DashboardLayout title="Dashboard">
			<DoctorDashboardHome />
		</DashboardLayout>
	);
}
