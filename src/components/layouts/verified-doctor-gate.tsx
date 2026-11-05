"use client";

import { CalendarClock, Loader2 } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/components/contexts/auth-provider";
import DoctorAppointmentSocketListener from "@/components/dashboard/appointments/doctor-appointment-socket-listener";
import SecretaryPaused from "@/components/layouts/secretary-paused";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { isDoctorOnlyPath, usePractice } from "@/hooks/use-practice";

/**
 * Lets in a verified doctor, or a secretary of one. Unverified doctors go to
 * their profile; secretaries can't open doctor-only pages.
 */
export default function VerifiedDoctorGate({
	children,
}: {
	children: React.ReactNode;
}) {
	const { user } = useAuth();
	const router = useRouter();
	const pathname = usePathname();
	const { me, isLoading, practice, isSecretary, isPausedSecretary, canWork } =
		usePractice();

	const blockedForSecretary = isSecretary && isDoctorOnlyPath(pathname);

	useEffect(() => {
		if (isLoading || !me || isPausedSecretary) return;
		if (!canWork) router.replace("/dashboard/profile");
		else if (blockedForSecretary) router.replace("/dashboard");
	}, [isLoading, me, isPausedSecretary, canWork, blockedForSecretary, router]);

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

	if (isPausedSecretary) {
		return <SecretaryPaused doctorName={practice?.doctorName ?? null} />;
	}

	if (!canWork || blockedForSecretary || !practice) {
		return null;
	}

	const hasAvailability = Object.values(practice.availability ?? {}).some(
		(slots) => slots.length > 0,
	);
	const onAvailabilityPage = pathname === "/dashboard/availability";

	return (
		<>
			<DoctorAppointmentSocketListener doctorId={practice.doctorId} />
			{!hasAvailability && !onAvailabilityPage && (
				<Alert variant="warning" className="mb-4">
					<CalendarClock className="size-4" />
					<AlertTitle>Availability not set</AlertTitle>
					<AlertDescription>
						Patients can't book appointments until working hours are set.{" "}
						<Link
							href="/dashboard/availability"
							className="font-medium underline"
						>
							Set availability
						</Link>
					</AlertDescription>
				</Alert>
			)}
			{children}
		</>
	);
}
