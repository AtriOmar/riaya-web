import { and, eq, gte, inArray, isNull, lt, ne, or } from "drizzle-orm";
import { db } from "@/db";
import { appointment, doctorProfile, speciality } from "@/db/schema";
import {
	findNextAvailableSlot,
	listAvailableSlotsForDoctor,
} from "@/lib/doctor-slots";
import { getDriveLegs } from "@/lib/route-matrix";

/** Doctors Riaya may refer patients to: verified and not excluded by an admin. */
export const referableDoctor = and(
	eq(doctorProfile.status, "verified"),
	isNull(doctorProfile.bestFitExcludedAt),
);

/** Doctors beyond this radius (km) are excluded — prevents cross-city matches. */
export const BEST_FIT_MAX_RADIUS_KM = 50;

/**
 * When no doctor inside the radius has a slot, the nearest doctors beyond it
 * are returned instead (flagged `outsideRadius`) so callers never get an empty
 * answer just because the area is sparse.
 */
export const BEST_FIT_FALLBACK_COUNT = 3;

/** How many top straight-line candidates get re-ranked by real drive time. */
export const BEST_FIT_ROUTE_CANDIDATES = 8;

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

/**
 * Verified doctors with a cabinet location, optionally narrowed to one
 * speciality. With a patient location, only doctors inside the radius are kept;
 * if nobody is, the nearest few are returned so a sparse area is never empty.
 * Shared by the admin calendar (range) and map endpoints.
 */
export async function listFinderDoctors(opts: {
	specialityId: number | null;
	location: { lat: number; long: number } | null;
}) {
	const { specialityId, location } = opts;
	const allDoctors = await db
		.select()
		.from(doctorProfile)
		.where(
			and(
				referableDoctor,
				specialityId != null
					? eq(doctorProfile.specialityId, specialityId)
					: undefined,
			),
		);

	const withCoords = allDoctors.filter(
		(d) => d.cabinetLatitude != null && d.cabinetLongitude != null,
	);
	if (!location) return withCoords;

	const ranked = withCoords
		.map((d) => ({
			d,
			km: calculateHaversineKm(
				location.lat,
				location.long,
				d.cabinetLatitude as number,
				d.cabinetLongitude as number,
			),
		}))
		.sort((x, y) => x.km - y.km);
	const inRadius = ranked.filter((r) => r.km <= BEST_FIT_MAX_RADIUS_KM);
	return (
		inRadius.length > 0 ? inRadius : ranked.slice(0, BEST_FIT_FALLBACK_COUNT)
	).map((r) => r.d);
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
	/** True when the doctor is beyond the radius and only returned as a fallback. */
	outsideRadius?: boolean;
	/** Road distance / drive time from the patient; set when routing succeeded. */
	roadDistanceKm?: number;
	driveMinutes?: number;
	nextSlot: { start: Date; end: Date };
	nearbySlots: { start: Date; end: Date }[];
};

/**
 * Rank verified doctors for a speciality near (lat, long) around desiredTime.
 * Applies the 50 km radius filter and scores by
 * distance + |slot − desiredTime| / TIME_WEIGHT. If nobody inside the radius
 * has a slot, falls back to the nearest few doctors beyond it.
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
			and(referableDoctor, eq(doctorProfile.specialityId, params.specialityId)),
		);

	const withDistance = doctors
		.filter((d) => d.cabinetLatitude != null && d.cabinetLongitude != null)
		.map((d) => ({
			...d,
			distance: calculateHaversineKm(
				params.lat,
				params.long,
				d.cabinetLatitude as number,
				d.cabinetLongitude as number,
			),
		}));

	if (withDistance.length === 0) return [];

	const inRadius = withDistance.filter((d) => d.distance <= maxRadiusKm);
	const beyondRadius = withDistance
		.filter((d) => d.distance > maxRadiusKm)
		.sort((a, b) => a.distance - b.distance);

	// Load appointments once for every doctor we might need (radius + fallback).
	const candidates = [
		...inRadius,
		...beyondRadius.slice(0, BEST_FIT_FALLBACK_COUNT),
	];
	const nearbyIds = candidates.map((d) => d.id);
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

	function process(
		list: typeof withDistance,
		outsideRadius: boolean,
	): BestFitDoctorResult[] {
		const out: BestFitDoctorResult[] = [];
		for (const doctor of list) {
			const doctorAppts = apptsByDoctor.get(doctor.id) ?? [];
			const availability = doctor.availability ?? {};
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

			out.push({
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
				...(outsideRadius ? { outsideRadius: true } : {}),
				nextSlot: nextSlotRaw,
				nearbySlots: nearbySlotsRaw,
			});
		}
		return out;
	}

	const timeDiffMin = (r: BestFitDoctorResult) =>
		Math.abs(r.nextSlot.start.getTime() - desiredTime.getTime()) / (1000 * 60);
	const score = (r: BestFitDoctorResult) =>
		(r.roadDistanceKm ?? r.distance) + timeDiffMin(r) / BEST_FIT_TIME_WEIGHT;

	/**
	 * Sort by straight-line score, then re-rank the top few by real road
	 * distance. Road distance is never below straight-line, so only the head of
	 * the list can change order; the rest keeps its order after it.
	 */
	async function rank(list: BestFitDoctorResult[]) {
		list.sort((a, b) => score(a) - score(b));

		const head = list.slice(0, BEST_FIT_ROUTE_CANDIDATES);
		const legs = await getDriveLegs(
			{ lat: params.lat, long: params.long },
			head.map((d) => ({
				lat: d.cabinetLatitude as number,
				long: d.cabinetLongitude as number,
			})),
		);
		if (!legs) return list;

		head.forEach((d, i) => {
			const leg = legs[i];
			if (!leg) return;
			d.roadDistanceKm = leg.distanceKm;
			d.driveMinutes = leg.minutes;
		});
		head.sort((a, b) => score(a) - score(b));
		return [...head, ...list.slice(BEST_FIT_ROUTE_CANDIDATES)];
	}

	const processed = process(inRadius, false);
	if (processed.length === 0) {
		// Nobody in range has a slot: offer the nearest ones beyond the radius.
		const fallback = process(
			beyondRadius.slice(0, BEST_FIT_FALLBACK_COUNT),
			true,
		);
		return fallback.sort((a, b) => a.distance - b.distance);
	}

	return rank(processed);
}
