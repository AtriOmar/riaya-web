import { and, eq, gte, isNull, lt, ne, or } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { appointment, doctorProfile, speciality } from "@/db/schema";
import { apiError, json, validationError } from "@/lib/api-utils";
import { type Availability, findNextAvailableSlot } from "@/lib/doctor-slots";

// ─── GET /api/doctors/best-fit ────────────────────────────────────────────────
// Public endpoint — finds best-fit doctors based on speciality, location, and time

const schema = z.object({
	speciality: z.string().min(1),
	long: z.coerce.number(),
	lat: z.coerce.number(),
	time: z.string().optional(),
});

function calculateDistance(
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

export async function GET(req: NextRequest) {
	try {
		const searchParams = Object.fromEntries(req.nextUrl.searchParams);
		const parsed = schema.safeParse(searchParams);

		if (!parsed.success) return validationError(parsed.error.issues);

		const {
			speciality: specialitySearchTerm,
			long,
			lat,
			time: desiredTimeParam,
		} = parsed.data;
		const currentTime = new Date();
		let desiredTime: Date;
		if (desiredTimeParam) {
			desiredTime = new Date(desiredTimeParam);
			if (Number.isNaN(desiredTime.getTime()) || desiredTime < currentTime) {
				return apiError("INVALID_DESIRED_TIME");
			}
		} else {
			desiredTime = currentTime;
		}

		const nextWeek = new Date(desiredTime.getTime() + 7 * 24 * 60 * 60 * 1000);

		// Find speciality by slug or translated names
		const specialities = await db
			.select()
			.from(speciality)
			.where(
				or(
					eq(speciality.slug, specialitySearchTerm),
					eq(speciality.enName, specialitySearchTerm),
					eq(speciality.frName, specialitySearchTerm),
					eq(speciality.arName, specialitySearchTerm),
				),
			);

		// Fallback: try case-insensitive match
		const specialityData = specialities[0];
		if (!specialityData) return apiError("SPECIALITY_NOT_FOUND");

		// Fetch verified doctors with this speciality
		const doctors = await db
			.select()
			.from(doctorProfile)
			.where(
				and(
					eq(doctorProfile.status, "verified"),
					eq(doctorProfile.specialityId, specialityData.id),
				),
			);

		const processedDoctors = (
			await Promise.all(
				doctors.map(async (doctor) => {
					if (!doctor.cabinetLatitude || !doctor.cabinetLongitude) return null;

					const distance = calculateDistance(
						lat,
						long,
						doctor.cabinetLatitude,
						doctor.cabinetLongitude,
					);

					const appointments = await db
						.select({
							start: appointment.start,
							end: appointment.end,
						})
						.from(appointment)
						.where(
							and(
								eq(appointment.doctorId, doctor.id),
								gte(appointment.start, currentTime),
								lt(appointment.start, nextWeek),
								or(
									isNull(appointment.status),
									ne(appointment.status, "cancelled"),
								),
							),
						);

					const availability = (doctor.availability as Availability) ?? {};
					const nextSlot = findNextAvailableSlot(
						availability,
						appointments,
						currentTime,
						desiredTime,
					);

					if (!nextSlot) return null;

					const { availability: _avail, ...rest } = doctor;
					return {
						...rest,
						address: rest.address ?? null,
						distance,
						nextSlot,
					};
				}),
			)
		).filter(Boolean);

		const weight = 10;
		processedDoctors.sort((a, b) => {
			const now = new Date();
			const timeDiffA =
				(a?.nextSlot
					? new Date(a.nextSlot.start).getTime() - now.getTime()
					: 0) /
				(1000 * 60);
			const timeDiffB =
				(b?.nextSlot
					? new Date(b.nextSlot.start).getTime() - now.getTime()
					: 0) /
				(1000 * 60);

			const distanceA = a?.distance ?? 0;
			const distanceB = b?.distance ?? 0;

			return distanceA + timeDiffA / weight - (distanceB + timeDiffB / weight);
		});

		return json(processedDoctors);
	} catch (e) {
		if (e instanceof Response) return e;
		return apiError("INTERNAL_ERROR");
	}
}
