"use client";

import useSWR from "swr";
import { useAuth } from "@/components/contexts/auth-provider";
import ApplicationStatus from "@/components/dashboard/application-status";
import { getMyDoctorApplication, getSpecialities } from "@/services";
import DoctorApplicationForm from "./doctor-application-form";
import ProfilePicture from "./picture";
import UserInfoReadOnly from "./user-info-readonly";

export default function Profile() {
	const { user } = useAuth();

	const { data: application, mutate: mutateApp } = useSWR(
		user ? "my-application" : null,
		() => getMyDoctorApplication().catch(() => null),
	);

	const { data: specialities } = useSWR("specialities", () =>
		getSpecialities(),
	);

	const status = application?.status ?? "none";
	const showReadOnly = status === "verified" || status === "pending";
	const showForm = status === "none" || status === "rejected";
	const showBanned = status === "banned";

	return (
		<div>
			<ApplicationStatus
				status={status}
				rejectionReasons={application?.rejectionReasons}
			/>
			<ProfilePicture />

			{showReadOnly && application && (
				<UserInfoReadOnly application={application} />
			)}

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
					onApplicationSubmitted={() => mutateApp()}
				/>
			)}
		</div>
	);
}
