import { and, eq, gte, isNull, lt, ne, or } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { appointment, doctorProfile } from "@/db/schema";
import { apiError, json, validationError } from "@/lib/api-utils";
import {
	type Availability,
	listAvailableSlotsForDoctor,
} from "@/lib/doctor-slots";

const schema = z.object({
	doctor_id: z.coerce.number().int().positive(),
	time: z.string().optional(),
	limit: z.coerce.number().int().min(1).max(10).optional(),
});
export async function GET(req: NextRequest) {
	try {
		const searchParams = Object.fromEntries(req.nextUrl.searchParams);
		const parsed = schema.safeParse(searchParams);
		if (!parsed.success) return validationError(parsed.error.issues);
		const {
			doctor_id: doctorId,
			time: anchorTimeParam,
			limit = 5,
		} = parsed.data;
		const currentTime = new Date();
		let anchorTime = currentTime;
		if (anchorTimeParam) {
			const parsedTime = new Date(anchorTimeParam);
			if (Number.isNaN(parsedTime.getTime()) || parsedTime < currentTime) {
				return apiError("INVALID_DESIRED_TIME");
			}
			anchorTime = parsedTime;
		}
		const doctor = await db
			.select()
			.from(doctorProfile)
			.where(
				and(
					eq(doctorProfile.id, doctorId),
					eq(doctorProfile.status, "verified"),
				),
			)
			.limit(1);
		const doctorData = doctor[0];
		if (!doctorData) return apiError("DOCTOR_NOT_FOUND");
		const nextWeek = new Date(anchorTime.getTime() + 7 * 24 * 60 * 60 * 1000);
		const appointments = await db
			.select({ start: appointment.start, end: appointment.end })
			.from(appointment)
			.where(
				and(
					eq(appointment.doctorId, doctorData.id),
					gte(appointment.start, currentTime),
					lt(appointment.start, nextWeek),
					or(isNull(appointment.status), ne(appointment.status, "cancelled")),
				),
			);
		const availability = (doctorData.availability as Availability) ?? {};
		const slots = listAvailableSlotsForDoctor(
			availability,
			appointments,
			currentTime,
			anchorTime,
			limit,
		);
		return json({
			doctor: {
				id: doctorData.id,
				firstName: doctorData.firstName,
				lastName: doctorData.lastName,
				cabinetName: doctorData.cabinetName,
				address: doctorData.address ?? null,
			},
			found: slots.length > 0,
			slots: slots.map((slot) => ({ start: slot.start, end: slot.end })),
		});
	} catch (e) {
		if (e instanceof Response) return e;
		return apiError("INTERNAL_ERROR");
	}
}
