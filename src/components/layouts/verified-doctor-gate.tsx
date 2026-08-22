"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import useSWR from "swr";
import { useAuth } from "@/components/contexts/auth-provider";
import DoctorAppointmentSocketListener from "@/components/dashboard/appointments/doctor-appointment-socket-listener";
import { getMe } from "@/services/users";

export default function VerifiedDoctorGate({
	children,
}: {
	children: React.ReactNode;
}) {
	const { user } = useAuth();
	const router = useRouter();

	const { data: me, isLoading } = useSWR(user ? "/api/users/me" : null, () =>
		getMe(),
	);

	const profile = me?.doctorProfile;
	const isVerified = profile?.status === "verified";

	useEffect(() => {
		if (!isLoading && me && !isVerified) {
			router.replace("/dashboard/profile");
		}
	}, [isLoading, me, isVerified, router]);

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

	if (!isVerified) {
		return null;
	}

	return (
		<>
			<DoctorAppointmentSocketListener doctorId={profile.id} />
			{children}
		</>
	);
}
