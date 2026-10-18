"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import DoctorDashboardHome from "@/components/dashboard/home/doctor-dashboard-home";
import DashboardLayout from "@/components/layouts/dashboard-layout";
import SecretaryPaused from "@/components/layouts/secretary-paused";
import { usePractice } from "@/hooks/use-practice";

export default function DashboardHome() {
	const router = useRouter();
	const { me, isLoading, practice, isPausedSecretary, canWork } = usePractice();

	useEffect(() => {
		if (!isLoading && me && !canWork && !isPausedSecretary) {
			router.replace("/dashboard/profile");
		}
	}, [isLoading, me, canWork, isPausedSecretary, router]);

	if (isPausedSecretary) {
		return <SecretaryPaused doctorName={practice?.doctorName ?? null} />;
	}

	if (!canWork) {
		return null;
	}

	return (
		<DashboardLayout title="Dashboard">
			<DoctorDashboardHome />
		</DashboardLayout>
	);
}
