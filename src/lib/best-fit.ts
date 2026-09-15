import { and, eq, gte, inArray, isNull, lt, ne, or } from "drizzle-orm";
import { db } from "@/db";
import { appointment, doctorProfile, speciality } from "@/db/schema";
import {
	type Availability,
	findNextAvailableSlot,
	listAvailableSlotsForDoctor,
} from "@/lib/doctor-slots";

/** Doctors beyond this radius (km) are excluded — prevents cross-city matches. */
export const BEST_FIT_MAX_RADIUS_KM = 50;

/** Extra forward slots returned alongside nextSlot. */
export const BEST_FIT_NEARBY_SLOTS_LIMIT = 3;

/** Weight: TIME_WEIGHT minutes of |slot − preferred| ≈ 1 km of distance. */
export const BEST_FIT_TIME_WEIGHT = 10;

export function calculateHaversineKm(
	lat1: number,
	lon1: number,
	lat2: number,
	lon2: number,
): number {
	const toRad = (angle: number) => (Math.PI / 180) * angle;
	const R = 6371;
	const dLat = toRad(lat2 - lat1);
	const dLon = toRad(lon2 - lon1);
	const a =
		Math.sin(dLat / 2) ** 2 +
		Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
	const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
	return R * c;
}

export async function resolveSpeciality(searchTerm: string) {
	const specialities = await db
		.select()
		.from(speciality)
		.where(
			or(
				eq(speciality.slug, searchTerm),
				eq(speciality.enName, searchTerm),
				eq(speciality.frName, searchTerm),
				eq(speciality.arName, searchTerm),
			),
		);
	return specialities[0] ?? null;
}

export type BestFitDoctorResult = {
	id: number;
	userId: string;
	firstName: string | null;
	lastName: string | null;
	cabinetName: string | null;
	cabinetCityId: number | null;
	cabinetLatitude: number | null;
	cabinetLongitude: number | null;
	specialityId: number | null;
	address: string | null;
	distance: number;
	nextSlot: { start: Date; end: Date };
	nearbySlots: { start: Date; end: Date }[];
};

/**
 * Rank verified doctors for a speciality near (lat, long) around desiredTime.
 * Applies the 50 km radius filter and scores by
 * distance + |slot − desiredTime| / TIME_WEIGHT.
 */
export async function findBestFitDoctors(params: {
	specialityId: number;
	lat: number;
	long: number;
	desiredTime: Date;
	currentTime?: Date;
	maxRadiusKm?: number;
	nearbySlotsLimit?: number;
}): Promise<BestFitDoctorResult[]> {
	const currentTime = params.currentTime ?? new Date();
	const maxRadiusKm = params.maxRadiusKm ?? BEST_FIT_MAX_RADIUS_KM;
	const nearbySlotsLimit =
		params.nearbySlotsLimit ?? BEST_FIT_NEARBY_SLOTS_LIMIT;
	const desiredTime = params.desiredTime;
	const nextWeek = new Date(desiredTime.getTime() + 7 * 24 * 60 * 60 * 1000);

	const doctors = await db
		.select()
		.from(doctorProfile)
		.where(
			and(
				eq(doctorProfile.status, "verified"),
				eq(doctorProfile.specialityId, params.specialityId),
			),
		);

	const nearbyDoctors = doctors
		.filter((d) => d.cabinetLatitude != null && d.cabinetLongitude != null)
		.map((d) => ({
			...d,
			distance: calculateHaversineKm(
				params.lat,
				params.long,
				d.cabinetLatitude as number,
				d.cabinetLongitude as number,
			),
		}))
		.filter((d) => d.distance <= maxRadiusKm);

	if (nearbyDoctors.length === 0) return [];

	const nearbyIds = nearbyDoctors.map((d) => d.id);
	const allAppointments = await db
		.select({
			doctorId: appointment.doctorId,
			start: appointment.start,
			end: appointment.end,
		})
		.from(appointment)
		.where(
			and(
				inArray(appointment.doctorId, nearbyIds),
				gte(appointment.start, currentTime),
				lt(appointment.start, nextWeek),
				or(isNull(appointment.status), ne(appointment.status, "cancelled")),
			),
		);

	const apptsByDoctor = new Map<
		number,
		{ start: Date | null; end: Date | null }[]
	>();
	for (const appt of allAppointments) {
		if (appt.doctorId == null) continue;
		const list = apptsByDoctor.get(appt.doctorId) ?? [];
		list.push({ start: appt.start, end: appt.end });
		apptsByDoctor.set(appt.doctorId, list);
	}

	const processed: BestFitDoctorResult[] = [];
	for (const doctor of nearbyDoctors) {
		const doctorAppts = apptsByDoctor.get(doctor.id) ?? [];
		const availability = (doctor.availability as Availability) ?? {};
		const nextSlotRaw = findNextAvailableSlot(
			availability,
			doctorAppts,
			currentTime,
			desiredTime,
		);
		if (!nextSlotRaw) continue;

		const nearbySlotsRaw = listAvailableSlotsForDoctor(
			availability,
			doctorAppts,
			currentTime,
			desiredTime,
			nearbySlotsLimit,
		);

		processed.push({
			id: doctor.id,
			userId: doctor.userId,
			firstName: doctor.firstName,
			lastName: doctor.lastName,
			cabinetName: doctor.cabinetName,
			cabinetCityId: doctor.cabinetCityId,
			cabinetLatitude: doctor.cabinetLatitude,
			cabinetLongitude: doctor.cabinetLongitude,
			specialityId: doctor.specialityId,
			address: doctor.address ?? null,
			distance: doctor.distance,
			nextSlot: nextSlotRaw,
			nearbySlots: nearbySlotsRaw,
		});
	}

	processed.sort((a, b) => {
		const timeDiffA =
			Math.abs(a.nextSlot.start.getTime() - desiredTime.getTime()) /
			(1000 * 60);
		const timeDiffB =
			Math.abs(b.nextSlot.start.getTime() - desiredTime.getTime()) /
			(1000 * 60);
		return (
			a.distance +
			timeDiffA / BEST_FIT_TIME_WEIGHT -
			(b.distance + timeDiffB / BEST_FIT_TIME_WEIGHT)
		);
	});

	return processed;
}
