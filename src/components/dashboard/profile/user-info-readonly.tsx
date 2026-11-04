"use client";

import Image from "next/image";
import DocumentPreview from "@/components/document-preview";
import type {
	GetApiDoctorApplicationsId200,
	GetApiDoctorApplicationsMe200,
	GetApiUsersId200DoctorProfile,
	GetApiUsersMe200DoctorProfile,
} from "@/services/generated/api.schemas";
import CabinetAddressField from "./cabinet-address-field";
import CabinetLocationMap from "./doctor-application/cabinet-location-map";

type Props = {
	/** Prefer doctor profile when it exists; otherwise application data (e.g. pending before profile row). */
	/** Given for a verified doctor on their own page: makes the address editable. */
	onSaveAddress?: (address: string) => Promise<void>;
	info:
		| GetApiDoctorApplicationsId200
		| GetApiDoctorApplicationsMe200
		| GetApiUsersId200DoctorProfile
		| GetApiUsersMe200DoctorProfile;
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

export default function UserInfoReadOnly({ info, onSaveAddress }: Props) {
	if (!info) return null;

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
			{/* 1. Personal Information */}
			<div>
				<h4 className="font-semibold text-lg border-b pb-2 mb-4">
					Personal Information
				</h4>
				<div className="gap-4 grid sm:grid-cols-2">
					<InfoField label="First Name" value={info.firstName} />
					<InfoField label="Last Name" value={info.lastName} />
					<InfoField label="CIN Number" value={info.cin} />
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
							<DocumentPreview
								url={info.medicalCouncilCertificate}
								alt="Medical Council Certificate"
							/>
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
					<div className="sm:col-span-2">
						{onSaveAddress ? (
							<CabinetAddressField
								value={info.cabinetAddress}
								onSave={onSaveAddress}
							/>
						) : (
							<InfoField label="Cabinet Address" value={info.cabinetAddress} />
						)}
					</div>
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
