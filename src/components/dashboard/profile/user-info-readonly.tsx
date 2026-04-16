"use client";

import Image from "next/image";
import type { DoctorApplicationDetail } from "@/services/types";

type Props = {
	application: DoctorApplicationDetail;
};

export default function UserInfoReadOnly({ application }: Props) {
	const cabinetCityName =
		application.cabinetCity?.enName ??
		application.cabinetCity?.frName ??
		application.cabinetCity?.arName;
	const specialityName =
		application.speciality?.enName ??
		application.speciality?.frName ??
		application.speciality?.arName;

	const rows = [
		{ label: "First Name", value: application.firstName },
		{ label: "Last Name", value: application.lastName },
		{ label: "TIN", value: application.tin },
		{ label: "Cabinet Name", value: application.cabinetName },
		{ label: "Cabinet City", value: cabinetCityName },
		{ label: "Speciality", value: specialityName ?? "—" },
	];

	return (
		<div className="space-y-4 mt-4">
			<h3 className="font-semibold text-xl">Your Information</h3>
			<div className="gap-4 grid sm:grid-cols-2">
				{rows.map((r) => (
					<div key={r.label}>
						<p className="font-medium text-muted-foreground text-sm">
							{r.label}
						</p>
						<p className="mt-1 px-3 py-1.5 rounded-md bg-muted text-sm">
							{r.value ?? "—"}
						</p>
					</div>
				))}
			</div>

			<div className="gap-4 grid lg:grid-cols-2 mt-4">
				{application.cinRecto && (
					<div>
						<p className="mb-2 font-medium text-muted-foreground text-sm">
							CIN Recto
						</p>
						<Image
							unoptimized
							src={application.cinRecto}
							alt="CIN Recto"
							width={300}
							height={200}
							className="w-full max-w-[300px] border rounded-lg"
						/>
					</div>
				)}
				{application.cinVerso && (
					<div>
						<p className="mb-2 font-medium text-muted-foreground text-sm">
							CIN Verso
						</p>
						<Image
							unoptimized
							src={application.cinVerso}
							alt="CIN Verso"
							width={300}
							height={200}
							className="w-full max-w-[300px] border rounded-lg"
						/>
					</div>
				)}
			</div>
		</div>
	);
}
