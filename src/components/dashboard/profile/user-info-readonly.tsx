"use client";

import Image from "next/image";
import type {
	DoctorApplicationDetail,
	DoctorProfileWithRelations,
} from "@/services/types";

type Props = {
	/** Prefer doctor profile when it exists; otherwise application data (e.g. pending before profile row). */
	info: DoctorProfileWithRelations | DoctorApplicationDetail;
};

export default function UserInfoReadOnly({ info }: Props) {
	const cabinetCityName =
		info.cabinetCity?.enName ??
		info.cabinetCity?.frName ??
		info.cabinetCity?.arName;
	const specialityName =
		info.speciality?.enName ??
		info.speciality?.frName ??
		info.speciality?.arName;

	const rows = [
		{ label: "First Name", value: info.firstName },
		{ label: "Last Name", value: info.lastName },
		{ label: "TIN", value: info.tin },
		{ label: "Cabinet Name", value: info.cabinetName },
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
				{info.cinRecto && (
					<div>
						<p className="mb-2 font-medium text-muted-foreground text-sm">
							CIN Recto
						</p>
						<Image
							unoptimized
							src={info.cinRecto}
							alt="CIN Recto"
							width={300}
							height={200}
							className="w-full max-w-[300px] border rounded-lg"
						/>
					</div>
				)}
				{info.cinVerso && (
					<div>
						<p className="mb-2 font-medium text-muted-foreground text-sm">
							CIN Verso
						</p>
						<Image
							unoptimized
							src={info.cinVerso}
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
