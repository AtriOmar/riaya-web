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

// Internal socket service URL — used to fire-and-forget WhatsApp messages
const SOCKET_INTERNAL_URL =
	process.env.SOCKET_INTERNAL_URL ?? "http://localhost:8080";

function buildConfirmationMessage(params: {
	patientName: string;
	doctorFirstName: string | null | undefined;
	doctorLastName: string | null | undefined;
	start: Date | null | undefined;
}): string {
	const doctorName =
		[params.doctorFirstName, params.doctorLastName].filter(Boolean).join(" ") ||
		"الطبيب";
	const date = params.start
		? params.start.toLocaleString("ar-MA", {
				weekday: "long",
				year: "numeric",
				month: "long",
				day: "numeric",
				hour: "2-digit",
				minute: "2-digit",
			})
		: "";
	return `مرحباً ${params.patientName}، تم تأكيد موعدك مع الدكتور ${doctorName}${date ? ` بتاريخ ${date}` : ""}. شكراً لك.`;
}

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
});

export async function PUT(req: NextRequest) {
	try {
		const session = await requireSession();
		const profile = await requireDoctorProfile(session.user.id);
		const body = await req.json();
		const parsed = updateSchema.safeParse(body);

		if (!parsed.success) return validationError(parsed.error.issues);

		const { id, ...fields } = parsed.data;
		const updateData: Record<string, unknown> = {};
		if (fields.name !== undefined) updateData.name = fields.name;
		if (fields.description !== undefined)
			updateData.description = fields.description;
		if (fields.start !== undefined) updateData.start = new Date(fields.start);
		if (fields.end !== undefined) updateData.end = new Date(fields.end);
		if (fields.status !== undefined) updateData.status = fields.status;

		const [updated] = await db
			.update(appointment)
			.set(updateData)
			.where(and(eq(appointment.id, id), eq(appointment.doctorId, profile.id)))
			.returning();

		if (!updated) return apiError("APPOINTMENT_NOT_FOUND");

		// Fire-and-forget: send WhatsApp confirmation when status becomes "confirmed"
		if (fields.status === "confirmed") {
			(async () => {
				try {
					const full = await db.query.appointment.findFirst({
						where: eq(appointment.id, id),
						with: { patient: true, doctor: true },
					});

					const phone =
						full?.patient?.phoneNumber ?? full?.newPatientPhoneNumber;
					const patientName = full?.patient
						? `${full.patient.firstName ?? ""} ${full.patient.lastName ?? ""}`.trim()
						: (full?.newPatientName ?? "");

					if (phone && patientName) {
						const message = buildConfirmationMessage({
							patientName,
							doctorFirstName: full?.doctor?.firstName,
							doctorLastName: full?.doctor?.lastName,
							start: full?.start,
						});
						await axios.post(`${SOCKET_INTERNAL_URL}/send-whatsapp`, {
							phone,
							message,
						});
					}
				} catch {
					// Non-critical — do not let WhatsApp errors affect the API response
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
