import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { patient, person } from "@/db/schema";
import { apiError } from "@/lib/api-utils";
import { splitCallerName } from "@/lib/caller-name";
import { upsertPersonByPhone } from "@/lib/person";
import {
	DEFAULT_PHONE_COUNTRY,
	normalizePhoneForStorage,
	phoneStorageVariants,
} from "@/lib/phone";

/** Doctor-scoped patient match by phone (person link or patient.phoneNumber). */
export async function findDoctorPatientByPhone(
	doctorId: number,
	phoneNumber: string,
) {
	const normalized = normalizePhoneForStorage(
		phoneNumber,
		DEFAULT_PHONE_COUNTRY,
	);
	if (!normalized) return null;

	const variants = phoneStorageVariants(normalized);

	const personRow = await db.query.person.findFirst({
		where: inArray(person.phoneNumber, variants),
	});

	if (personRow) {
		const byPerson = await db.query.patient.findFirst({
			where: and(
				eq(patient.doctorId, doctorId),
				eq(patient.personId, personRow.id),
			),
		});
		if (byPerson) return byPerson;
	}

	return db.query.patient.findFirst({
		where: and(
			eq(patient.doctorId, doctorId),
			inArray(patient.phoneNumber, variants),
		),
	});
}

async function assertDoctorPatient(doctorId: number, patientId: number) {
	const row = await db.query.patient.findFirst({
		where: and(eq(patient.id, patientId), eq(patient.doctorId, doctorId)),
	});
	if (!row) throw apiError("PATIENT_NOT_FOUND");
	return row.id;
}

export async function createMinimalPatientForCaller(
	doctorId: number,
	phoneNumber: string,
	callerName: string | null | undefined,
	nameOverride?: { firstName?: string; lastName?: string },
) {
	const normalized = normalizePhoneForStorage(
		phoneNumber,
		DEFAULT_PHONE_COUNTRY,
	);
	if (!normalized) throw apiError("PATIENT_PHONE_REQUIRED");

	const personRow = await upsertPersonByPhone(normalized, "call");
	if (!personRow) throw apiError("VALIDATION_ERROR");

	const existing = await findDoctorPatientByPhone(doctorId, normalized);
	if (existing) return existing.id;

	const fallback = splitCallerName(callerName);
	const firstName = nameOverride?.firstName?.trim() || fallback.firstName;
	const lastName = nameOverride?.lastName?.trim() || fallback.lastName;
	if (!firstName) throw apiError("VALIDATION_ERROR");

	const [created] = await db
		.insert(patient)
		.values({
			personId: personRow.id,
			doctorId,
			firstName,
			lastName,
			phoneNumber: normalized,
		})
		.returning();

	return created.id;
}

type AppointmentForLink = {
	patientId: number | null;
	newPatientPhoneNumber: string | null;
	newPatientName: string | null;
};

/**
 * Resolve which patient to attach when confirming an unlinked appointment.
 * - Existing appointment.patientId → unchanged
 * - Phone matches a doctor patient → link automatically
 * - Else patientId in input → link that patient
 * - Else createPatient → create minimal patient from caller fields
 */
export async function resolvePatientIdForConfirm(
	doctorId: number,
	appt: AppointmentForLink,
	input: {
		patientId?: number;
		createPatient?: boolean;
		patientFirstName?: string;
		patientLastName?: string;
	},
): Promise<number | null> {
	if (appt.patientId) return appt.patientId;

	const phone = normalizePhoneForStorage(
		appt.newPatientPhoneNumber,
		DEFAULT_PHONE_COUNTRY,
	);
	if (!phone) {
		if (input.patientId != null) {
			return assertDoctorPatient(doctorId, input.patientId);
		}
		return null;
	}

	const matched = await findDoctorPatientByPhone(doctorId, phone);
	if (matched) {
		if (input.patientId != null && input.patientId !== matched.id) {
			return assertDoctorPatient(doctorId, input.patientId);
		}
		return matched.id;
	}

	if (input.patientId != null) {
		return assertDoctorPatient(doctorId, input.patientId);
	}

	if (input.createPatient) {
		return createMinimalPatientForCaller(doctorId, phone, appt.newPatientName, {
			firstName: input.patientFirstName,
			lastName: input.patientLastName,
		});
	}

	throw apiError("PATIENT_ASSIGNMENT_REQUIRED");
}
