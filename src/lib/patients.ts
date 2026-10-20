import { and, asc, eq, ilike, or } from "drizzle-orm";
import { db } from "@/db";
import { patient } from "@/db/schema";

/**
 * The doctor's patients, optionally filtered by a search. Every word of the
 * search must match the first name, last name or CIN, so "Sami Ben Ali" finds
 * the patient whose first name is Sami and last name is Ben Ali.
 */
export async function searchPatients(
	doctorId: number,
	search?: string,
	options: { limit?: number } = {},
) {
	const words = (search ?? "").trim().split(/\s+/).filter(Boolean);
	const query = db
		.select({
			id: patient.id,
			firstName: patient.firstName,
			lastName: patient.lastName,
			cin: patient.cin,
			dateOfBirth: patient.dateOfBirth,
		})
		.from(patient)
		.where(
			and(
				eq(patient.doctorId, doctorId),
				...words.map((word) =>
					or(
						ilike(patient.firstName, `%${word}%`),
						ilike(patient.lastName, `%${word}%`),
						ilike(patient.cin, `%${word}%`),
					),
				),
			),
		)
		.orderBy(asc(patient.lastName), asc(patient.firstName));
	return options.limit ? query.limit(options.limit) : query;
}
