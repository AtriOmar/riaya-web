import { and, eq, gte, isNull, lt, ne, or } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { appointment, doctorProfile, speciality } from "@/db/schema";
import { apiError, json, validationError } from "@/lib/api-utils";
import { type Availability, listSlotsForDay } from "@/lib/doctor-slots";

// ─── GET /api/doctors/best-fit/range ─────────────────────────────────────────
// Admin tool endpoint — returns best-fit doctors grouped by day for a date range.
// Used by the admin "Best Fit Finder" tool to render a month-view calendar heatmap
// where each day shows which doctors are available on that day.

const schema = z.object({
	speciality: z.string().min(1),
	long: z.coerce.number(),
	lat: z.coerce.number(),
	from: z.string(),
	to: z.string(),
});

const MAX_RANGE_DAYS = 62; // ~2 months

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

function toDateOnly(d: Date): string {
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, "0");
	const day = String(d.getDate()).padStart(2, "0");
	return `${y}-${m}-${day}`;
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
			from: fromParam,
			to: toParam,
		} = parsed.data;

		const from = new Date(fromParam);
		const to = new Date(toParam);
		if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
			return apiError("INVALID_DESIRED_TIME");
		}
		if (to < from) return apiError("INVALID_TIME_RANGE");

		// Normalise to local start-of-day boundaries.
		from.setHours(0, 0, 0, 0);
		to.setHours(23, 59, 59, 999);

		const rangeMs = to.getTime() - from.getTime();
		const rangeDays = Math.ceil(rangeMs / (24 * 60 * 60 * 1000));
		if (rangeDays > MAX_RANGE_DAYS) return apiError("INVALID_TIME_RANGE");

		const currentTime = new Date();

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

		// Build list of dates in range (inclusive)
		const days: Date[] = [];
		const cursor = new Date(from);
		while (cursor <= to) {
			days.push(new Date(cursor));
			cursor.setDate(cursor.getDate() + 1);
		}

		type SlotDto = { start: string; end: string };
		type DoctorDayResult = {
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
			slots: SlotDto[];
		};
		type DayEntry = { date: string; doctors: DoctorDayResult[] };

		const dayMap = new Map<string, DoctorDayResult[]>();
		for (const d of days) dayMap.set(toDateOnly(d), []);

		await Promise.all(
			doctors.map(async (doctor) => {
				if (!doctor.cabinetLatitude || !doctor.cabinetLongitude) return;

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
							gte(appointment.start, from),
							lt(appointment.start, new Date(to.getTime() + 1)),
							or(
								isNull(appointment.status),
								ne(appointment.status, "cancelled"),
							),
						),
					);

				const availability = (doctor.availability as Availability) ?? {};

				for (const day of days) {
					const slots = listSlotsForDay(
						availability,
						appointments,
						currentTime,
						day,
					);
					if (slots.length === 0) continue;

					const key = toDateOnly(day);
					const entry: DoctorDayResult = {
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
						distance,
						slots: slots.map((s) => ({
							start: s.start.toISOString(),
							end: s.end.toISOString(),
						})),
					};
					dayMap.get(key)?.push(entry);
				}
			}),
		);

		// Score = distance + minutesUntilFirstSlot / weight (mirror /best-fit)
		const weight = 10;
		const scoreOf = (d: DoctorDayResult) => {
			const first = d.slots[0];
			const timeDiff = first
				? (new Date(first.start).getTime() - currentTime.getTime()) /
					(1000 * 60)
				: 0;
			return d.distance + timeDiff / weight;
		};

		const result: DayEntry[] = [];
		for (const [date, docs] of dayMap) {
			if (docs.length === 0) continue;
			docs.sort((a, b) => scoreOf(a) - scoreOf(b));
			result.push({ date, doctors: docs });
		}
		result.sort((a, b) => a.date.localeCompare(b.date));

		return json(result);
	} catch (e) {
		if (e instanceof Response) return e;
		return apiError("INTERNAL_ERROR");
	}
}

import { selectBestFitDoctorSchema } from "@/db/zod";
import { registry } from "@/lib/openapi";

const bestFitRangeDoctorSchema = selectBestFitDoctorSchema
	.omit({ nextSlot: true })
	.merge(
		z.object({
			slots: z.array(z.object({ start: z.string(), end: z.string() })),
		}),
	);

const bestFitRangeDaySchema = z.object({
	date: z.string(),
	doctors: z.array(bestFitRangeDoctorSchema),
});

registry.registerPath({
	method: "get",
	path: "/api/doctors/best-fit/range",
	tags: ["Doctors"],
	summary: "Find best fit doctors grouped by day for a date range",
	request: { query: schema },
	responses: {
		200: {
			description: "List of days with matching doctors and their slots",
			content: {
				"application/json": { schema: z.array(bestFitRangeDaySchema) },
			},
		},
	},
});
