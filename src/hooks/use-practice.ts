"use client";

import { useAuth } from "@/components/contexts/auth-provider";
import { useGetApiUsersMe } from "@/services/generated/users/users";

/** Dashboard pages a secretary can't open (doctor-only). */
export const DOCTOR_ONLY_PATHS = [
	"/dashboard/recordings",
	"/dashboard/ai-chat",
	"/dashboard/whatsapp-config",
	"/dashboard/subscription",
	"/dashboard/team",
	"/dashboard/settings",
];

export function isDoctorOnlyPath(pathname: string): boolean {
	return DOCTOR_ONLY_PATHS.some(
		(p) => pathname === p || pathname.startsWith(`${p}/`),
	);
}

/**
 * The practice the signed-in user works in, as its doctor or as a secretary.
 * `canWork` = a verified doctor, or a secretary whose access isn't paused.
 */
export function usePractice() {
	const { user } = useAuth();
	const { data: me, isLoading } = useGetApiUsersMe({
		swr: { enabled: !!user },
	});

	const practice = me?.practice ?? null;
	const isSecretary = practice?.role === "secretary";
	const canWork = isSecretary
		? practice.active
		: me?.doctorProfile?.status === "verified";

	return {
		me,
		isLoading: !!user && isLoading,
		practice,
		isSecretary,
		/** Paused: a secretary whose doctor's plan no longer includes them */
		isPausedSecretary: isSecretary && !practice.active,
		canWork,
		doctorId: practice?.doctorId ?? null,
	};
}
