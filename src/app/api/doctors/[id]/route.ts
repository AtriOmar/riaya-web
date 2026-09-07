import { and, eq, gte, isNull, lt, ne, or } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { appointment, doctorProfile } from "@/db/schema";
import { apiError, json, requireAdmin, validationError } from "@/lib/api-utils";

// ─── GET /api/doctors/[id] ────────────────────────────────────────────────────
// Admin-only. Returns a doctor profile (with availability + speciality + cabinet
// city relations) plus the appointments within an optional date range. Used by
// the admin "Best Fit Finder" tool to render a doctor's full availability
// calendar with existing bookings overlaid.

const querySchema = z.object({
	from: z.string().optional(),
	to: z.string().optional(),
});

export async function GET(
	req: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	try {
		await requireAdmin();
		const { id } = await params;
		const numericId = Number(id);
		if (!Number.isFinite(numericId)) return apiError("INVALID_ID");

		const searchParams = Object.fromEntries(req.nextUrl.searchParams);
		const parsed = querySchema.safeParse(searchParams);
		if (!parsed.success) return validationError(parsed.error.issues);

		const doctor = await db.query.doctorProfile.findFirst({
			where: eq(doctorProfile.id, numericId),
			with: { speciality: true, cabinetCity: true },
		});

		if (!doctor) return apiError("DOCTOR_NOT_FOUND");

		// Default window: current week ± 30 days if not provided.
		const now = new Date();
		const defaultFrom = new Date(now);
		defaultFrom.setDate(defaultFrom.getDate() - 7);
		defaultFrom.setHours(0, 0, 0, 0);
		const defaultTo = new Date(now);
		defaultTo.setDate(defaultTo.getDate() + 30);
		defaultTo.setHours(23, 59, 59, 999);

		const from = parsed.data.from ? new Date(parsed.data.from) : defaultFrom;
		const to = parsed.data.to ? new Date(parsed.data.to) : defaultTo;
		if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
			return apiError("INVALID_DESIRED_TIME");
		}

		const appointments = await db
			.select({
				id: appointment.id,
				start: appointment.start,
				end: appointment.end,
				status: appointment.status,
				name: appointment.name,
				description: appointment.description,
				newPatientName: appointment.newPatientName,
			})
			.from(appointment)
			.where(
				and(
					eq(appointment.doctorId, doctor.id),
					gte(appointment.start, from),
					lt(appointment.start, to),
					or(isNull(appointment.status), ne(appointment.status, "cancelled")),
				),
			);

		return json({ doctor, appointments });
	} catch (e) {
		if (e instanceof Response) return e;
		return apiError("INTERNAL_ERROR");
	}
}

import {
	selectAppointmentSchema,
	selectDoctorProfileWithRelationsSchema,
} from "@/db/zod";
import { registry } from "@/lib/openapi";

const paramsSchema = z.object({ id: z.string() });

registry.registerPath({
	method: "get",
	path: "/api/doctors/{id}",
	tags: ["Doctors"],
	summary: "Get doctor profile with appointments (Admin)",
	request: { params: paramsSchema, query: querySchema },
	responses: {
		200: {
			description: "Doctor profile + appointments in range",
			content: {
				"application/json": {
					schema: z.object({
						doctor: selectDoctorProfileWithRelationsSchema,
						appointments: z.array(
							selectAppointmentSchema.pick({
								id: true,
								start: true,
								end: true,
								status: true,
								name: true,
								description: true,
								newPatientName: true,
							}),
						),
					}),
				},
			},
		},
	},
});
