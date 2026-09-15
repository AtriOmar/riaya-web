import axios from "axios";
import { and, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { appointment } from "@/db/schema";
import {
	apiError,
	json,
	requireDoctorProfile,
	requireSession,
	validationError,
} from "@/lib/api-utils";
import { resolvePatientIdForConfirm } from "@/lib/appointment-patient-link";
import { cancelEmergencySiblingAppointments } from "@/lib/emergency-appointments";
import {
	cancelEmergencyPendingTimeoutJob,
	cancelPendingAppointmentTimeoutJob,
} from "@/lib/pending-appointment-timeout";
import { resolvePreferredLanguage } from "@/lib/person";
import { assertAndRecordWhatsappSend } from "@/lib/plan-limits";
import { reviewQueue } from "@/lib/queue";
import { getRealtimeHttpUrl } from "@/lib/realtime";
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
				with: { patient: true },
			});
			return json(appointments);
		}

		// Doctor's own appointments
		const profile = await requireDoctorProfile(session.user.id);
		const appointments = await db.query.appointment.findMany({
			where: eq(appointment.doctorId, profile.id),
			with: { patient: true },
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
		const session = await requireSession();
		const profile = await requireDoctorProfile(session.user.id);
		const body = await req.json();
		const parsed = createSchema.safeParse(body);

		if (!parsed.success) return validationError(parsed.error.issues);

		const [created] = await db
			.insert(appointment)
			.values({
				doctorId: profile.id,
				patientId: parsed.data.patientId,
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
		const session = await requireSession();
		const profile = await requireDoctorProfile(session.user.id);
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
				updateData.newPatientName = null;
				updateData.newPatientPhoneNumber = null;
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
			void cancelEmergencyPendingTimeoutJob(updated.emergencyGroupId);
		} else if (
			(fields.status === "confirmed" || fields.status === "cancelled") &&
			updated.source === "ai"
		) {
			void cancelPendingAppointmentTimeoutJob(updated.id);
			if (updated.emergencyGroupId) {
				// Last pending in a group may have been refused — drop timeout if none left pending.
				const stillPending = await db.query.appointment.findFirst({
					where: and(
						eq(appointment.emergencyGroupId, updated.emergencyGroupId),
						eq(appointment.status, "pending"),
					),
				});
				if (!stillPending) {
					void cancelEmergencyPendingTimeoutJob(updated.emergencyGroupId);
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
							patient: { with: { person: true } },
							doctor: true,
						},
					});

					const phone =
						full?.patient?.phoneNumber ?? full?.newPatientPhoneNumber;
					const patientName = full?.patient
						? `${full.patient.firstName ?? ""} ${full.patient.lastName ?? ""}`.trim()
						: (full?.newPatientName ?? "");

					if (phone && patientName) {
						const language = await resolvePreferredLanguage({
							preferredLanguage: full?.patient?.person?.preferredLanguage,
							phone,
						});
						const message = buildAppointmentConfirmationMessage({
							language,
							patientName,
							doctorFirstName: full?.doctor?.firstName,
							doctorLastName: full?.doctor?.lastName,
							start: full?.start,
						});
						try {
							const httpUrl = getRealtimeHttpUrl();
							if (!httpUrl) {
								console.error("NEXT_PUBLIC_REALTIME_URL is not set");
							} else {
								await assertAndRecordWhatsappSend(profile.id);
								await axios.post(`${httpUrl}/send-whatsapp`, {
									userId: full?.doctor?.userId,
									phone,
									message,
									quotaConsumed: true,
								});
							}
						} catch (waErr) {
							if (waErr instanceof Response) {
								const body = await waErr.json().catch(() => null);
								console.error(
									"WhatsApp confirmation skipped (limit or error):",
									body ?? waErr.status,
								);
							} else {
								throw waErr;
							}
						}
					}

					// Schedule a review request 2 hours after the appointment ends
					if (updated.end) {
						const delay = Math.max(
							0,
							new Date(updated.end).getTime() + 2 * 60 * 60 * 1000 - Date.now(),
						);
						await reviewQueue.add(
							"sendReview",
							{
								appointmentId: updated.id,
								doctorId: updated.doctorId,
								patientId: updated.patientId,
							},
							{ delay },
						);
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
		const session = await requireSession();
		const profile = await requireDoctorProfile(session.user.id);
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

import { selectAppointmentSchema, selectPatientSchema } from "@/db/zod";
import { registry } from "@/lib/openapi";

const appointmentWithPatientSchema = selectAppointmentSchema.merge(
	z.object({ patient: selectPatientSchema.nullable() }),
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
