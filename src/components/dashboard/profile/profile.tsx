"use client";

import useSWR from "swr";
import { useAuth } from "@/components/contexts/auth-provider";
import ApplicationStatus from "@/components/dashboard/application-status";
import { getMyDoctorApplication, getSpecialities } from "@/services";
import { getMe } from "@/services/users";
import DoctorApplicationForm from "./doctor-application-form";
import ProfilePicture from "./picture";
import UserInfoReadOnly from "./user-info-readonly";

export default function Profile() {
	const { user } = useAuth();

	const { data: me, mutate: mutateMe } = useSWR(
		user ? "/api/users/me" : null,
		() => getMe(),
	);

	const { data: application, mutate: mutateApp } = useSWR(
		user ? "/api/doctor-applications/me" : null,
		() => getMyDoctorApplication().catch(() => null),
	);

	const { data: specialities } = useSWR("specialities", () =>
		getSpecialities(),
	);

	const profile = me?.doctorProfile ?? null;
	/** Prefer doctor profile status; fall back to application when there is no profile row yet. */
	const status = profile?.status ?? application?.status ?? "none";

	const showReadOnly = status === "verified" || status === "pending";
	const showForm = status === "none" || status === "rejected";
	const showBanned = status === "banned";

	const readOnlyInfo = profile ?? application;

	const refreshAfterApplication = () => {
		void mutateMe();
		void mutateApp();
	};

	return (
		<div>
			<ApplicationStatus
				status={status}
				rejectionReasons={application?.rejectionReasons}
			/>
			<ProfilePicture />

			{showReadOnly && readOnlyInfo && <UserInfoReadOnly info={readOnlyInfo} />}

			{showBanned && (
				<div className="mt-5">
					<h3 className="font-semibold text-xl">Your Information</h3>
					<div className="mt-4">
						<p className="font-medium text-muted-foreground text-sm">Email</p>
						<p className="px-3 py-1.5 rounded-md bg-muted text-muted-foreground text-sm">
							{user?.email}
						</p>
					</div>
				</div>
			)}

			{showForm && (
				<DoctorApplicationForm
					specialities={specialities ?? []}
					onApplicationSubmitted={refreshAfterApplication}
				/>
			)}
		</div>
	);
}
