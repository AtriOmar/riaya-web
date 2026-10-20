import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { patient, person } from "@/db/schema";
import { apiError } from "@/lib/api-utils";

/** The doctor's patient file for this person, if they have one. */
export async function findDoctorPatientByPerson(
	doctorId: number,
	personId: number,
) {
	return db.query.patient.findFirst({
		where: and(eq(patient.doctorId, doctorId), eq(patient.personId, personId)),
	});
}

async function assertDoctorPatient(doctorId: number, patientId: number) {
	const row = await db.query.patient.findFirst({
		where: and(eq(patient.id, patientId), eq(patient.doctorId, doctorId)),
	});
	if (!row) throw apiError("PATIENT_NOT_FOUND");
	return row.id;
}

/** Create the doctor's file for a person, named from the person unless overridden. */
async function createPatientForPerson(
	doctorId: number,
	personId: number,
	contactPhone: string | null,
	nameOverride: { firstName?: string; lastName?: string },
) {
	const existing = await findDoctorPatientByPerson(doctorId, personId);
	if (existing) return existing.id;

	const personRow = await db.query.person.findFirst({
		where: eq(person.id, personId),
	});
	if (!personRow) throw apiError("VALIDATION_ERROR");

	// The doctor's edited name wins over the one the assistant captured.
	const overrideFirst = nameOverride.firstName?.trim();
	const firstName = overrideFirst || personRow.firstName;
	const lastName = overrideFirst
		? nameOverride.lastName?.trim() || null
		: personRow.lastName;
	if (!firstName) throw apiError("VALIDATION_ERROR");

	const [created] = await db
		.insert(patient)
		.values({
			personId,
			doctorId,
			firstName,
			lastName,
			phoneNumber: contactPhone,
		})
		.returning();

	return created.id;
}

type AppointmentForLink = {
	patientId: number | null;
	personId: number | null;
	contactPhone: string | null;
};

/**
 * Resolve which patient file to attach when the doctor accepts an appointment.
 * - Already linked → unchanged
 * - Doctor picked a file → that file
 * - The doctor already has a file for the appointment's person → that file
 * - createPatient → new file for the person
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

	if (input.patientId != null) {
		return assertDoctorPatient(doctorId, input.patientId);
	}

	if (appt.personId == null) return null;

	const matched = await findDoctorPatientByPerson(doctorId, appt.personId);
	if (matched) return matched.id;

	if (input.createPatient) {
		return createPatientForPerson(doctorId, appt.personId, appt.contactPhone, {
			firstName: input.patientFirstName,
			lastName: input.patientLastName,
		});
	}

	throw apiError("PATIENT_ASSIGNMENT_REQUIRED");
}
