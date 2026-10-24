import { and, eq, gt, gte, isNull, lt, lte, ne, or } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { appointment, doctorProfile } from "@/db/schema";
import {
	apiError,
	json,
	requireInternal,
	validationError,
} from "@/lib/api-utils";
import { schedulePendingAppointmentTimeout } from "@/lib/pending-appointment-timeout";
import { bookingPatientSchema, resolveBookingPerson } from "@/lib/person";
import { normalizePhoneForStorage } from "@/lib/phone";
import { practiceDayIndex, practiceMinutes } from "@/lib/practice-time";
import { clearRefusalContext } from "@/lib/refusal-suggestions";

// ─── POST /api/appointments/external ─────────────────────────────────────────
// Internal (voice assistant): book a pending appointment for someone on the calling phone.

/** Where the patient searched from; kept on the booking so the next call can offer it again. */
const patientPlaceSchema = z.object({
	label: z.string().max(255).nullable(),
	lat: z.number(),
	long: z.number(),
});

const externalSchema = z.object({
	doctorId: z.coerce.number().int().positive(),
	/** The calling phone line. */
	phoneNumber: z.string().min(1, "Phone number is required"),
	patient: bookingPatientSchema,
	start: z.iso.datetime(),
	end: z.iso.datetime(),
	illness: z.string(),
	patientPlace: patientPlaceSchema.optional(),
});

export async function POST(req: NextRequest) {
	try {
		requireInternal(req);
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

		// Check availability (opening hours are Tunis wall-clock times)
		const availability =
			doctor.availability?.[practiceDayIndex(startDate)] ?? [];

		if (!availability.length) return apiError("DOCTOR_UNAVAILABLE_DAY");

		const startMinutes = practiceMinutes(startDate);
		const endMinutes = practiceMinutes(endDate);

		const isWithinAvailability = availability.some(
			(slot) => startMinutes >= slot.start && endMinutes <= slot.end,
		);

		if (!isWithinAvailability) return apiError("DOCTOR_UNAVAILABLE_TIME");

		// Check for overlapping appointments (a refused or cancelled one frees its slot)
		const overlapping = await db
			.select({ id: appointment.id })
			.from(appointment)
			.where(
				and(
					eq(appointment.doctorId, data.doctorId),
					or(isNull(appointment.status), ne(appointment.status, "cancelled")),
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

		const patientPerson = await resolveBookingPerson(
			data.phoneNumber,
			data.patient,
		);

		const [created] = await db
			.insert(appointment)
			.values({
				doctorId: doctor.id,
				start: startDate,
				end: endDate,
				personId: patientPerson.id,
				contactPhone: data.phoneNumber,
				status: "pending",
				source: "ai",
				name: "Consultation",
				description: data.illness,
				patientPlaceLabel: data.patientPlace?.label ?? null,
				patientLatitude: data.patientPlace?.lat ?? null,
				patientLongitude: data.patientPlace?.long ?? null,
			})
			.returning();

		// The patient found a new doctor: stop suggesting alternatives on next call.
		void clearRefusalContext(data.phoneNumber);

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
