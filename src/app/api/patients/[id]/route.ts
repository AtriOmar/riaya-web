import { and, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { patient } from "@/db/schema";
import {
	apiError,
	json,
	requireDoctorProfile,
	requireSession,
	validationError,
} from "@/lib/api-utils";

const updateSchema = z.object({
	cin: z.string().min(1),
	firstName: z.string().min(1),
	lastName: z.string().min(1),
	dateOfBirth: z.string().datetime(),
	gender: z.string().min(1),
	address: z.string(),
	phoneNumber: z.string(),
});

// ─── GET /api/patients/[id] ──────────────────────────────────────────────────

export async function GET(
	_req: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	try {
		const session = await requireSession();
		const profile = await requireDoctorProfile(session.user.id);

		const { id } = await params;
		const patientId = Number(id);
		if (Number.isNaN(patientId)) return apiError("INVALID_ID");

		const record = await db.query.patient.findFirst({
			where: and(eq(patient.id, patientId), eq(patient.doctorId, profile.id)),
			with: { medicalFiles: true },
		});

		if (!record) return apiError("PATIENT_NOT_FOUND");

		return json(record);
	} catch (e) {
		if (e instanceof Response) return e;
		return apiError("INTERNAL_ERROR");
	}
}

// ─── PATCH /api/patients/[id] ─────────────────────────────────────────────────

export async function PATCH(
	req: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	try {
		const session = await requireSession();
		const profile = await requireDoctorProfile(session.user.id);

		const { id } = await params;
		const patientId = Number(id);
		if (Number.isNaN(patientId)) return apiError("INVALID_ID");

		const existing = await db.query.patient.findFirst({
			where: and(eq(patient.id, patientId), eq(patient.doctorId, profile.id)),
		});

		if (!existing) return apiError("PATIENT_NOT_FOUND");

		const body = await req.json();
		const parsed = updateSchema.safeParse(body);

		if (!parsed.success) return validationError(parsed.error.issues);

		const phone = parsed.data.phoneNumber.trim();

		await db
			.update(patient)
			.set({
				cin: parsed.data.cin,
				firstName: parsed.data.firstName,
				lastName: parsed.data.lastName,
				dateOfBirth: new Date(parsed.data.dateOfBirth),
				gender: parsed.data.gender,
				address: parsed.data.address || null,
				phoneNumber: phone || null,
				updatedAt: new Date(),
			})
			.where(and(eq(patient.id, patientId), eq(patient.doctorId, profile.id)));

		const record = await db.query.patient.findFirst({
			where: and(eq(patient.id, patientId), eq(patient.doctorId, profile.id)),
			with: { medicalFiles: true },
		});

		if (!record) return apiError("PATIENT_NOT_FOUND");

		return json(record);
	} catch (e) {
		if (e instanceof Response) return e;
		return apiError("INTERNAL_ERROR");
	}
}
