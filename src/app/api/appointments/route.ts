import axios from "axios";
import { and, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { appointment, patient } from "@/db/schema";
import {
	apiError,
	json,
	requireSession,
	validationError,
} from "@/lib/api-utils";
import { resolvePatientIdForConfirm } from "@/lib/appointment-patient-link";
import { cancelEmergencySiblingAppointments } from "@/lib/emergency-appointments";
import {
	cancelEmergencyPendingTimeoutJob,
	cancelPendingAppointmentTimeoutJob,
	expediteEmergencyPendingTimeout,
	scheduleRefusalNotification,
} from "@/lib/pending-appointment-timeout";
import { resolvePreferredLanguage } from "@/lib/person";
import { personDisplayName } from "@/lib/person-name";
import { requirePractice } from "@/lib/practice";
import { getRealtimeHttpUrl } from "@/lib/realtime";
import { recordRefusal } from "@/lib/refusal-suggestions";
import { scheduleReviewRequest } from "@/lib/review-scheduling";
import { buildAppointmentConfirmationMessage } from "@/lib/whatsapp-messages";

// ─── GET /api/appointments ────────────────────────────────────────────────────
// Returns appointments for the authenticated doctor

const getSchema = z.object({
	all: z.coerce.boolean().optional(),
});

export async function GET(req: NextRequest) {
	try {
		const session = await requireSession();
		const params = Object.fromEntries(req.nextUrl.searchParams);
		const parsed = getSchema.safeParse(params);

		if (!parsed.success) return validationError(parsed.error.issues);

		// If admin requests all appointments
		if (
			parsed.data.all &&
			session.user.accessId &&
			session.user.accessId >= 3
		) {
			const appointments = await db.query.appointment.findMany({
				with: { patient: true, person: true },
			});
			return json(appointments);
		}

		// Doctor's own appointments
		const { doctor: profile } = await requirePractice();
		const appointments = await db.query.appointment.findMany({
			where: eq(appointment.doctorId, profile.id),
			with: { patient: true, person: true },
		});
		return json(appointments);
	} catch (e) {
		if (e instanceof Response) return e;
		return apiError("INTERNAL_ERROR");
	}
}

// ─── POST /api/appointments ───────────────────────────────────────────────────

const createSchema = z.object({
	patientId: z.coerce.number().int().positive(),
	start: z.iso.datetime(),
	end: z.iso.datetime(),
	name: z.string().min(1),
	description: z.string().optional(),
});

export async function POST(req: NextRequest) {
	try {
		const { doctor: profile } = await requirePractice();
		const body = await req.json();
		const parsed = createSchema.safeParse(body);

		if (!parsed.success) return validationError(parsed.error.issues);

		const doctorPatient = await db.query.patient.findFirst({
			where: and(
				eq(patient.id, parsed.data.patientId),
				eq(patient.doctorId, profile.id),
			),
		});
		if (!doctorPatient) return apiError("PATIENT_NOT_FOUND");

		const [created] = await db
			.insert(appointment)
			.values({
				doctorId: profile.id,
				patientId: doctorPatient.id,
				personId: doctorPatient.personId,
				start: new Date(parsed.data.start),
				end: new Date(parsed.data.end),
				status: "confirmed",
				source: "dashboard",
				name: parsed.data.name,
				description: parsed.data.description,
			})
			.returning();

		return json(created, 201);
	} catch (e) {
		if (e instanceof Response) return e;
		return apiError("INTERNAL_ERROR");
	}
}

// ─── PUT /api/appointments ────────────────────────────────────────────────────

const updateSchema = z.object({
	id: z.coerce.number().int().positive(),
	name: z.string().optional(),
	description: z.string().optional(),
	start: z.string().datetime().optional(),
	end: z.string().datetime().optional(),
	status: z.enum(["pending", "confirmed", "cancelled"]).optional(),
	patientId: z.coerce.number().int().positive().optional(),
	createPatient: z.boolean().optional(),
	patientFirstName: z.string().min(1).optional(),
	patientLastName: z.string().optional(),
});

export async function PUT(req: NextRequest) {
	try {
		const { doctor: profile } = await requirePractice();
		const body = await req.json();
		const parsed = updateSchema.safeParse(body);

		if (!parsed.success) return validationError(parsed.error.issues);

		const {
			id,
			patientId: inputPatientId,
			createPatient,
			patientFirstName,
			patientLastName,
			...fields
		} = parsed.data;

		const existing = await db.query.appointment.findFirst({
			where: and(eq(appointment.id, id), eq(appointment.doctorId, profile.id)),
		});

		if (!existing) return apiError("APPOINTMENT_NOT_FOUND");

		// Another doctor already took this emergency fan-out (siblings cancelled).
		if (
			fields.status === "confirmed" &&
			existing.urgent &&
			existing.status === "cancelled"
		) {
			return apiError("APPOINTMENT_NOT_FOUND");
		}

		const updateData: Record<string, unknown> = {
			updatedAt: new Date(),
		};
		if (fields.name !== undefined) updateData.name = fields.name;
		if (fields.description !== undefined)
			updateData.description = fields.description;
		if (fields.start !== undefined) updateData.start = new Date(fields.start);
		if (fields.end !== undefined) updateData.end = new Date(fields.end);
		if (fields.status !== undefined) updateData.status = fields.status;

		if (fields.status === "confirmed" && !existing.patientId) {
			const resolvedPatientId = await resolvePatientIdForConfirm(
				profile.id,
				existing,
				{
					patientId: inputPatientId,
					createPatient,
					patientFirstName,
					patientLastName,
				},
			);
			if (resolvedPatientId != null) {
				updateData.patientId = resolvedPatientId;
			}
		}

		// First-accept wins for emergency fan-outs: only confirm while still pending.
		const confirmWhere =
			fields.status === "confirmed" && existing.status === "pending"
				? and(
						eq(appointment.id, id),
						eq(appointment.doctorId, profile.id),
						eq(appointment.status, "pending"),
					)
				: and(eq(appointment.id, id), eq(appointment.doctorId, profile.id));

		const [updated] = await db
			.update(appointment)
			.set(updateData)
			.where(confirmWhere)
			.returning();

		if (!updated) {
			// Lost the race against another doctor accepting the same emergency group,
			// or the row was cancelled meanwhile.
			return apiError("APPOINTMENT_NOT_FOUND");
		}

		// Confirm or reschedule of a confirmed visit: (re)queue the review request.
		if (
			updated.status === "confirmed" &&
			(fields.status === "confirmed" || fields.end !== undefined)
		) {
			void scheduleReviewRequest(updated).catch((err) =>
				console.error("Failed to schedule review request:", err),
			);
		}

		// Cancel sibling urgent requests so only one doctor keeps the patient.
		if (
			fields.status === "confirmed" &&
			updated.urgent &&
			updated.emergencyGroupId
		) {
			await cancelEmergencySiblingAppointments({
				emergencyGroupId: updated.emergencyGroupId,
				exceptAppointmentId: updated.id,
			});
			void cancelEmergencyPendingTimeoutJob({
				emergencyGroupId: updated.emergencyGroupId,
				wave: updated.emergencyWave ?? 1,
			});
		} else if (
			(fields.status === "confirmed" || fields.status === "cancelled") &&
			updated.source === "ai"
		) {
			void cancelPendingAppointmentTimeoutJob(updated.id);
			// Doctor refused a normal pending request: tell the patient.
			if (
				fields.status === "cancelled" &&
				existing.status === "pending" &&
				!updated.urgent
			) {
				const patientPhone = updated.contactPhone;
				void (async () => {
					try {
						// Record first: the notification job reads this context.
						if (patientPhone && updated.doctorId != null) {
							await recordRefusal({
								patientPhone,
								doctorId: updated.doctorId,
								desiredTime: updated.start,
							});
						}
						await scheduleRefusalNotification({ appointmentId: updated.id });
					} catch (err) {
						console.error("Failed to queue refusal notification:", err);
					}
				})();
			}
			if (updated.emergencyGroupId) {
				// Every doctor in this wave refused: send the next wave now instead of waiting.
				const stillPending = await db.query.appointment.findFirst({
					where: and(
						eq(appointment.emergencyGroupId, updated.emergencyGroupId),
						eq(appointment.status, "pending"),
					),
				});
				if (!stillPending) {
					void expediteEmergencyPendingTimeout({
						emergencyGroupId: updated.emergencyGroupId,
						wave: updated.emergencyWave ?? 1,
					});
				}
			}
		}

		// Fire-and-forget: send WhatsApp confirmation when status becomes "confirmed"
		if (fields.status === "confirmed") {
			(async () => {
				try {
					const full = await db.query.appointment.findFirst({
						where: eq(appointment.id, id),
						with: {
							patient: true,
							person: true,
							doctor: true,
						},
					});

					const phone = full?.contactPhone ?? full?.patient?.phoneNumber;
					const patientName =
						personDisplayName(full?.patient) || personDisplayName(full?.person);

					if (phone && patientName) {
						// The message goes to the phone line, so use its owner's language.
						const language = await resolvePreferredLanguage({ phone });
						const message = buildAppointmentConfirmationMessage({
							language,
							patientName,
							doctorFirstName: full?.doctor?.firstName,
							doctorLastName: full?.doctor?.lastName,
							start: full?.start,
						});
						// Automatic patient message: always sent, never counted against the plan.
						const httpUrl = getRealtimeHttpUrl();
						if (!httpUrl) {
							console.error("NEXT_PUBLIC_REALTIME_URL is not set");
						} else {
							await axios
								.post(`${httpUrl}/send-whatsapp`, {
									userId: full?.doctor?.userId,
									phone,
									message,
								})
								.catch((waErr) =>
									console.error("WhatsApp confirmation failed:", waErr),
								);
						}
					}
				} catch (err) {
					console.error(
						"Failed to send WhatsApp confirmation or schedule review:",
						err,
					);
				}
			})();
		}

		return json(updated);
	} catch (e) {
		if (e instanceof Response) return e;
		return apiError("INTERNAL_ERROR");
	}
}

// ─── DELETE /api/appointments ─────────────────────────────────────────────────

const deleteSchema = z.object({
	id: z.coerce.number().int().positive(),
});

export async function DELETE(req: NextRequest) {
	try {
		const { doctor: profile } = await requirePractice();
		const params = Object.fromEntries(req.nextUrl.searchParams);
		const parsed = deleteSchema.safeParse(params);

		if (!parsed.success) return validationError(parsed.error.issues);

		const [deleted] = await db
			.delete(appointment)
			.where(
				and(
					eq(appointment.id, parsed.data.id),
					eq(appointment.doctorId, profile.id),
				),
			)
			.returning();

		if (!deleted) return apiError("APPOINTMENT_NOT_FOUND");

		return json({ message: "Appointment deleted successfully" });
	} catch (e) {
		if (e instanceof Response) return e;
		return apiError("INTERNAL_ERROR");
	}
}

import {
	selectAppointmentSchema,
	selectPatientSchema,
	selectPersonSchema,
} from "@/db/zod";
import { registry } from "@/lib/openapi";

const appointmentWithPatientSchema = selectAppointmentSchema.merge(
	z.object({
		patient: selectPatientSchema.nullable(),
		person: selectPersonSchema.nullable(),
	}),
);

registry.registerPath({
	method: "get",
	path: "/api/appointments",
	tags: ["Appointments"],
	summary: "List appointments",
	request: { query: getSchema },
	responses: {
		200: {
			description: "List of appointments",
			content: {
				"application/json": { schema: z.array(appointmentWithPatientSchema) },
			},
		},
	},
});

registry.registerPath({
	method: "post",
	path: "/api/appointments",
	tags: ["Appointments"],
	summary: "Create appointment",
	request: {
		body: { content: { "application/json": { schema: createSchema } } },
	},
	responses: {
		201: {
			description: "Created appointment",
			content: { "application/json": { schema: selectAppointmentSchema } },
		},
	},
});

registry.registerPath({
	method: "put",
	path: "/api/appointments",
	tags: ["Appointments"],
	summary: "Update appointment",
	request: {
		body: { content: { "application/json": { schema: updateSchema } } },
	},
	responses: {
		200: {
			description: "Updated appointment",
			content: { "application/json": { schema: selectAppointmentSchema } },
		},
	},
});

registry.registerPath({
	method: "delete",
	path: "/api/appointments",
	tags: ["Appointments"],
	summary: "Delete appointment",
	request: { query: deleteSchema },
	responses: {
		200: {
			description: "Deleted appointment",
			content: {
				"application/json": { schema: z.object({ message: z.string() }) },
			},
		},
	},
});
