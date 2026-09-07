"use client";

import {
	ArrowLeft,
	Building2,
	MapPin,
	Stethoscope,
	UserRound,
} from "lucide-react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import DoctorAvailabilityCalendar from "@/components/admin/best-fit/doctor-availability-calendar";
import AdminLayout from "@/components/layouts/admin-layout";
import { CubeLoader } from "@/components/loaders";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAdminDoctor } from "@/hooks/use-admin-doctor";

function parseDateOnly(dateStr: string | null): Date | null {
	if (!dateStr) return null;
	const [y, m, d] = dateStr.split("-").map(Number);
	if (!y || !m || !d) return null;
	return new Date(y, m - 1, d, 0, 0, 0, 0);
}

function initials(firstName: string | null, lastName: string | null) {
	const a = firstName?.[0]?.toUpperCase() ?? "";
	const b = lastName?.[0]?.toUpperCase() ?? "";
	return `${a}${b}` || "DR";
}

function fullDoctorName(
	firstName: string | null,
	lastName: string | null,
	fallback = "Doctor",
) {
	const parts = [firstName, lastName].filter(Boolean).join(" ").trim();
	if (!parts) return fallback;
	return `Dr. ${parts}`;
}

export default function AdminBestFitDoctorPage() {
	const params = useParams<{ id: string }>();
	const searchParams = useSearchParams();
	const doctorId = Number(params.id);

	const fromParam = searchParams.get("from");
	const initialDate = useMemo(() => parseDateOnly(fromParam), [fromParam]);

	// Fetch a 5-week window around the initial date (or today) so the week
	// calendar has enough context when the admin scrolls back/forward.
	const rangeParams = useMemo(() => {
		const anchor = initialDate ?? new Date();
		const from = new Date(anchor);
		from.setDate(from.getDate() - 14);
		from.setHours(0, 0, 0, 0);
		const to = new Date(anchor);
		to.setDate(to.getDate() + 30);
		to.setHours(23, 59, 59, 999);
		return {
			id: doctorId,
			from: from.toISOString(),
			to: to.toISOString(),
		};
	}, [doctorId, initialDate]);

	const { data, isLoading, error } = useAdminDoctor(
		Number.isFinite(doctorId) ? rangeParams : null,
	);

	// Preserve filters when navigating back to the main page.
	const backHref = useMemo(() => {
		const p = new URLSearchParams();
		const specialityId = searchParams.get("specialityId");
		const cityId = searchParams.get("cityId");
		const day = searchParams.get("from");
		if (specialityId) p.set("specialityId", specialityId);
		if (cityId) p.set("cityId", cityId);
		if (day) p.set("day", day);
		const qs = p.toString();
		return `/admin/best-fit${qs ? `?${qs}` : ""}`;
	}, [searchParams]);

	return (
		<AdminLayout
			title={
				<div className="flex items-center gap-3">
					<Button variant="quiet" size="sm" asChild>
						<Link href={backHref}>
							<ArrowLeft className="w-4 h-4" />
							Back
						</Link>
					</Button>
					<span>Doctor availability</span>
				</div>
			}
		>
			{isLoading ? (
				<div className="flex justify-center py-16">
					<CubeLoader />
				</div>
			) : error || !data ? (
				<div className="flex flex-col justify-center items-center py-16 text-muted-foreground">
					<UserRound className="opacity-40 mb-3 w-12 h-12" />
					<p className="font-semibold text-foreground">Doctor not found</p>
					<p className="mt-1 text-sm">
						This doctor may have been removed or is no longer verified.
					</p>
				</div>
			) : (
				<>
					{/* Header card */}
					<div className="flex flex-wrap items-start gap-4 p-5 border rounded-xl bg-card">
						<Avatar size="lg">
							<AvatarFallback>
								{initials(data.doctor.firstName, data.doctor.lastName)}
							</AvatarFallback>
						</Avatar>
						<div className="flex-1 min-w-0">
							<div className="flex flex-wrap items-center gap-2">
								<h4 className="font-semibold text-lg">
									{fullDoctorName(data.doctor.firstName, data.doctor.lastName)}
								</h4>
								{data.doctor.status && (
									<Badge
										variant={
											data.doctor.status === "verified"
												? "success"
												: data.doctor.status === "pending"
													? "warning"
													: "secondary"
										}
									>
										{data.doctor.status}
									</Badge>
								)}
							</div>
							<div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-muted-foreground text-sm">
								{data.doctor.speciality && (
									<span className="inline-flex items-center gap-1.5">
										<Stethoscope className="w-4 h-4" />
										{data.doctor.speciality.enName ??
											data.doctor.speciality.frName ??
											data.doctor.speciality.slug}
									</span>
								)}
								{data.doctor.cabinetName && (
									<span className="inline-flex items-center gap-1.5">
										<Building2 className="w-4 h-4" />
										{data.doctor.cabinetName}
									</span>
								)}
								{(data.doctor.cabinetCity || data.doctor.address) && (
									<span className="inline-flex items-center gap-1.5">
										<MapPin className="w-4 h-4" />
										{data.doctor.address ??
											data.doctor.cabinetCity?.enName ??
											data.doctor.cabinetCity?.frName}
									</span>
								)}
							</div>
						</div>
					</div>

					{/* Legend */}
					<div className="flex flex-wrap items-center gap-4 mt-4 text-xs text-muted-foreground">
						<span className="inline-flex items-center gap-2">
							<span className="inline-block w-3 h-3 rounded-sm bg-green-500/20 border border-green-500/40" />
							Available slot
						</span>
						<span className="inline-flex items-center gap-2">
							<span className="inline-block w-3 h-3 rounded-sm bg-primary" />
							Confirmed appointment
						</span>
						<span className="inline-flex items-center gap-2">
							<span className="inline-block w-3 h-3 rounded-sm bg-yellow-600" />
							Pending appointment
						</span>
						<span className="inline-flex items-center gap-2">
							<span className="inline-block w-3 h-3 rounded-sm bg-slate-200 border border-slate-300" />
							Outside availability
						</span>
					</div>

					<DoctorAvailabilityCalendar
						initialDate={initialDate ?? undefined}
						availability={data.doctor.availability}
						appointments={data.appointments}
					/>
				</>
			)}
		</AdminLayout>
	);
}
