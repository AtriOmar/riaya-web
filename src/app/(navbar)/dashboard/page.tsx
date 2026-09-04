"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/components/contexts/auth-provider";
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
		<div className="pr-2 md:pr-10 pb-20 pl-2">
			<h3 className="font-bold text-2xl">Dashboard</h3>
			{/* Dashboard content will go here when verified */}
		</div>
	);
}
