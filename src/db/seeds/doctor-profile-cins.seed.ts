import { and, eq } from "drizzle-orm";
import { db } from "../index";
import { doctorProfile } from "../schema";
import { DOCTORS } from "./doctors";

/** Set `doctor_profile.cin` from the doctors list rows that have a CIN, matching trimmed first and last name. */
export async function seedDoctorProfileCins() {
	const doctors = DOCTORS;
	let doctorProfileRowsUpdated = 0;
	let entriesWithMatch = 0;

	for (const raw of doctors) {
		const cin = raw.cin?.trim();
		if (!cin) continue;

		const firstName = raw.firstName?.trim() ?? "";
		const lastName = raw.lastName?.trim() ?? "";
		if (firstName === "" && lastName === "") continue;

		const updated = await db
			.update(doctorProfile)
			.set({
				cin,
				updatedAt: new Date(),
			})
			.where(
				and(
					eq(doctorProfile.firstName, firstName),
					eq(doctorProfile.lastName, lastName),
				),
			)
			.returning({ id: doctorProfile.id });

		doctorProfileRowsUpdated += updated.length;
		if (updated.length > 0) entriesWithMatch += 1;
	}

	return { doctorProfileRowsUpdated, entriesWithMatch };
}
