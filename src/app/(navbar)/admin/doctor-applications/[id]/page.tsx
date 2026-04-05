"use client";

import { useParams } from "next/navigation";
import ApplicationDetail from "@/components/admin/application-detail";

export default function AdminDoctorApplicationPage() {
	const params = useParams<{ id: string }>();

	return (
		<div className="max-w-4xl pr-2 md:pr-10 pb-20 pl-2">
			<h3 className="font-bold text-2xl">Doctor Application</h3>
			<div className="mt-4">
				<ApplicationDetail applicationId={Number(params.id)} />
			</div>
		</div>
	);
}
