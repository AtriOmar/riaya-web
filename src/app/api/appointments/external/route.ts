import { and, eq, gt, gte, lt, lte, or } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { appointment, doctorProfile } from "@/db/schema";
import { apiError, json, validationError } from "@/lib/api-utils";
import { schedulePendingAppointmentTimeout } from "@/lib/pending-appointment-timeout";
import { upsertPersonByPhone } from "@/lib/person";
import { normalizePhoneForStorage } from "@/lib/phone";
import { assertAiBookingAllowed } from "@/lib/plan-limits";

// ─── POST /api/appointments/external ─────────────────────────────────────────
// Public endpoint — allows non-authenticated users to book an appointment

type AvailabilitySlot = { start: number; end: number };
type Availability = Record<number, AvailabilitySlot[]>;

const externalSchema = z.object({
	doctorId: z.coerce.number().int().positive(),
	name: z.string().min(1),
	phoneNumber: z.string().min(1, "Phone number is required"),
	start: z.iso.datetime(),
	end: z.iso.datetime(),
	illness: z.string(),
});

export async function POST(req: NextRequest) {
	try {
		const body = await req.json();
		const parsed = externalSchema.safeParse(body);

		if (!parsed.success) return validationError(parsed.error.issues);

		const normalizedPhone = normalizePhoneForStorage(parsed.data.phoneNumber);
		if (!normalizedPhone)
			return validationError([
				{ message: "Invalid phone number", path: ["phoneNumber"] },
			]);

		const data = { ...parsed.data, phoneNumber: normalizedPhone };

		// Find the doctor
		const [doctor] = await db
			.select()
			.from(doctorProfile)
			.where(eq(doctorProfile.id, data.doctorId));

		if (!doctor) return apiError("DOCTOR_NOT_FOUND");

		const startDate = new Date(data.start);
		const endDate = new Date(data.end);

		if (startDate >= endDate) return apiError("INVALID_TIME_RANGE");

		// Check availability
		let dayOfWeek = startDate.getDay();
		dayOfWeek = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
		const availability =
			(doctor.availability as Availability)?.[dayOfWeek] ?? [];

		if (!availability.length) return apiError("DOCTOR_UNAVAILABLE_DAY");

		const startMinutes = startDate.getHours() * 60 + startDate.getMinutes();
		const endMinutes = endDate.getHours() * 60 + endDate.getMinutes();

		const isWithinAvailability = availability.some(
			(slot) => startMinutes >= slot.start && endMinutes <= slot.end,
		);

		if (!isWithinAvailability) return apiError("DOCTOR_UNAVAILABLE_TIME");

		// Check for overlapping appointments
		const overlapping = await db
			.select({ id: appointment.id })
			.from(appointment)
			.where(
				and(
					eq(appointment.doctorId, data.doctorId),
					or(
						and(
							lt(appointment.start, startDate),
							gt(appointment.end, startDate),
						),
						and(lt(appointment.start, endDate), gt(appointment.end, endDate)),
						and(
							gte(appointment.start, startDate),
							lte(appointment.end, endDate),
						),
					),
				),
			);

		if (overlapping.length > 0) return apiError("APPOINTMENT_CONFLICT");

		await assertAiBookingAllowed(doctor.id, data.phoneNumber);

		// Upsert person by phone (fire-and-forget — we don't store personId on appointment yet)
		void upsertPersonByPhone(data.phoneNumber, "call");

		const [created] = await db
			.insert(appointment)
			.values({
				doctorId: doctor.id,
				start: startDate,
				end: endDate,
				newPatientName: data.name,
				newPatientPhoneNumber: data.phoneNumber,
				status: "pending",
				source: "ai",
				name: "Consultation",
				description: data.illness,
			})
			.returning();

		void schedulePendingAppointmentTimeout({
			appointmentId: created.id,
		}).catch((err) =>
			console.error("[appointments/external] schedule pending timeout", err),
		);

		return json(created, 201);
	} catch (e) {
		if (e instanceof Response) return e;
		return apiError("INTERNAL_ERROR");
	}
}

import { selectAppointmentSchema } from "@/db/zod";
import { registry } from "@/lib/openapi";

registry.registerPath({
	method: "post",
	path: "/api/appointments/external",
	tags: ["Appointments"],
	summary: "Book external appointment",
	request: {
		body: { content: { "application/json": { schema: externalSchema } } },
	},
	responses: {
		201: {
			description: "Booked appointment",
			content: { "application/json": { schema: selectAppointmentSchema } },
		},
	},
});
