import { and, eq, gte, inArray, isNull, lt, ne, or } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { appointment, speciality } from "@/db/schema";
import { apiError, json, validationError } from "@/lib/api-utils";
import { calculateHaversineKm, listFinderDoctors } from "@/lib/best-fit";
import { type Availability, listSlotsForDay } from "@/lib/doctor-slots";

// ─── GET /api/doctors/best-fit/range ─────────────────────────────────────────
// Admin tool endpoint — returns best-fit doctors grouped by day for a date range.
// Used by the admin "Best Fit Finder" tool to render a month-view calendar heatmap
// where each day shows which doctors are available on that day.
// `speciality` and the `lat`/`long` pair are each optional: without a speciality
// every verified doctor is returned; without a location there is no radius
// filter and `distance` is null.

const schema = z.object({
	speciality: z.string().min(1).optional(),
	long: z.coerce.number().optional(),
	lat: z.coerce.number().optional(),
	from: z.string(),
	to: z.string(),
});

const MAX_RANGE_DAYS = 62; // ~2 months

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
			from: fromParam,
			to: toParam,
		} = parsed.data;
		const location =
			parsed.data.lat != null &&
			parsed.data.long != null &&
			Number.isFinite(parsed.data.lat) &&
			Number.isFinite(parsed.data.long)
				? { lat: parsed.data.lat, long: parsed.data.long }
				: null;

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

		// Find speciality by slug or translated names (only when one is given)
		let specialityId: number | null = null;
		if (specialitySearchTerm) {
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
			specialityId = specialityData.id;
		}

		const doctors = await listFinderDoctors({ specialityId, location });

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
			distance: number | null;
			slots: SlotDto[];
		};
		type DayEntry = { date: string; doctors: DoctorDayResult[] };

		const dayMap = new Map<string, DoctorDayResult[]>();
		for (const d of days) dayMap.set(toDateOnly(d), []);

		if (doctors.length === 0) {
			return json([]);
		}

		// Batch-load all appointments for nearby doctors in a single query.
		const doctorIds = doctors.map((d) => d.id);
		const allAppointments = await db
			.select({
				doctorId: appointment.doctorId,
				start: appointment.start,
				end: appointment.end,
			})
			.from(appointment)
			.where(
				and(
					inArray(appointment.doctorId, doctorIds),
					gte(appointment.start, from),
					lt(appointment.start, new Date(to.getTime() + 1)),
					or(isNull(appointment.status), ne(appointment.status, "cancelled")),
				),
			);

		// Group by doctorId for O(1) lookup per doctor.
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

		for (const doctor of doctors) {
			const distance = location
				? calculateHaversineKm(
						location.lat,
						location.long,
						doctor.cabinetLatitude as number,
						doctor.cabinetLongitude as number,
					)
				: null;
			const doctorAppts = apptsByDoctor.get(doctor.id) ?? [];
			const availability = (doctor.availability as Availability) ?? {};

			for (const day of days) {
				const slots = listSlotsForDay(
					availability,
					doctorAppts,
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
		}

		// Score = distance + minutesUntilFirstSlot / weight (mirror /best-fit)
		const weight = 10;
		const scoreOf = (d: DoctorDayResult) => {
			const first = d.slots[0];
			const timeDiff = first
				? (new Date(first.start).getTime() - currentTime.getTime()) /
					(1000 * 60)
				: 0;
			return (d.distance ?? 0) + timeDiff / weight;
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
	.omit({ nextSlot: true, distance: true })
	.merge(
		z.object({
			distance: z.number().nullable(),
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
