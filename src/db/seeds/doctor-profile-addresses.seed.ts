import { and, eq } from "drizzle-orm";
import { db } from "../index";
import { doctorProfile } from "../schema";
import { DOCTORS } from "./doctors";

/** Set `doctor_profile.address` from the doctors list rows that have an address, matching trimmed first and last name. */
export async function seedDoctorProfileAddresses() {
	const doctors = DOCTORS;
	let doctorProfileRowsUpdated = 0;
	let entriesWithMatch = 0;

	for (const raw of doctors) {
		const address = raw.address?.trim();
		if (!address) continue;

		const firstName = raw.firstName?.trim() ?? "";
		const lastName = raw.lastName?.trim() ?? "";
		if (firstName === "" && lastName === "") continue;

		const updated = await db
			.update(doctorProfile)
			.set({
				address,
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
