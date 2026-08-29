"use client";

import { Layers } from "lucide-react";
import Image from "next/image";
import type {
	DoctorApplicationDetail,
	DoctorProfileWithRelations,
} from "@/services/types";
import CabinetLocationMap from "./doctor-application/cabinet-location-map";

type Props = {
	/** Prefer doctor profile when it exists; otherwise application data (e.g. pending before profile row). */
	info: DoctorProfileWithRelations | DoctorApplicationDetail;
	title?: string;
};

function InfoField({
	label,
	value,
}: {
	label: string;
	value: string | null | undefined;
}) {
	return (
		<div>
			<p className="font-medium text-muted-foreground text-sm">{label}</p>
			<p className="mt-1 px-3 py-1.5 rounded-sm border border-border/50 bg-muted text-sm font-medium">
				{value ?? "—"}
			</p>
		</div>
	);
}

export default function UserInfoReadOnly({
	info,
	title = "Your Information",
}: Props) {
	const cabinetCityName =
		info.cabinetCity?.enName ??
		info.cabinetCity?.frName ??
		info.cabinetCity?.arName;
	const specialityName =
		info.speciality?.enName ??
		info.speciality?.frName ??
		info.speciality?.arName;

	return (
		<div className="space-y-8 mt-4">
			{title && <h3 className="font-semibold text-xl">{title}</h3>}

			{/* 1. Personal Information */}
			<div>
				<h4 className="font-semibold text-lg border-b pb-2 mb-4">
					Personal Information
				</h4>
				<div className="gap-4 grid sm:grid-cols-2">
					<InfoField label="First Name" value={info.firstName} />
					<InfoField label="Last Name" value={info.lastName} />
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
								className="w-full max-w-[300px] border rounded-lg aspect-[14/9] object-cover"
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
								className="w-full max-w-[300px] border rounded-lg aspect-[14/9] object-cover"
							/>
						</div>
					)}
				</div>
			</div>

			{/* 2. Professional Information */}
			<div>
				<h4 className="font-semibold text-lg border-b pb-2 mb-4">
					Professional Information
				</h4>
				<div className="gap-4 grid sm:grid-cols-2">
					<InfoField label="Speciality" value={specialityName} />
					<InfoField
						label="Medical Council Number"
						value={info.medicalCouncilNumber}
					/>
				</div>
				{info.medicalCouncilCertificate && (
					<div className="mt-4">
						<p className="mb-2 font-medium text-muted-foreground text-sm">
							Medical Council Certificate
						</p>
						<div className="w-full max-w-[300px] aspect-[14/9] border rounded-lg overflow-hidden relative">
							{info.medicalCouncilCertificate.toLowerCase().endsWith(".pdf") ? (
								<object
									data={info.medicalCouncilCertificate}
									type="application/pdf"
									className="w-full h-full pointer-events-none"
								>
									<div className="flex flex-col justify-center items-center bg-muted/50 w-full h-full text-sm">
										<Layers className="mb-2 size-8 text-muted-foreground" />
										<span className="mt-1 text-muted-foreground text-xs">
											PDF Document
										</span>
									</div>
								</object>
							) : (
								<Image
									unoptimized
									src={info.medicalCouncilCertificate}
									alt="Medical Council Certificate"
									fill
									className="w-full h-full object-cover"
								/>
							)}
						</div>
					</div>
				)}
			</div>

			{/* 3. Business Information */}
			<div>
				<h4 className="font-semibold text-lg border-b pb-2 mb-4">
					Business Information
				</h4>
				<div className="gap-4 grid sm:grid-cols-2">
					<InfoField label="Cabinet Name" value={info.cabinetName} />
					<InfoField label="Cabinet City" value={cabinetCityName} />
					<InfoField label="TIN" value={info.tin} />
				</div>
				{info.cabinetLatitude && info.cabinetLongitude && (
					<div className="mt-4">
						<p className="mb-2 font-medium text-muted-foreground text-sm">
							Cabinet Location
						</p>
						<div className="relative z-0">
							<CabinetLocationMap
								className="h-[300px]"
								center={{
									lat: info.cabinetLatitude,
									lng: info.cabinetLongitude,
								}}
								marker={{
									lat: info.cabinetLatitude,
									lng: info.cabinetLongitude,
								}}
							/>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
