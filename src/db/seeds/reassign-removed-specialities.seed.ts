import { eq, inArray, notInArray } from "drizzle-orm";
import { db } from "../index";
import { doctorApplication, doctorProfile, speciality } from "../schema";

/** Slugs removed from patient-facing booking; must match dropped rows in `specialities.ts`. */
export const REMOVED_SPECIALITY_SLUGS = [
	"orthopedics_traumatology",
	"radiology",
	"parasitology",
	"radiation_oncology",
	"forensic_medicine",
	"nuclear_medicine",
	"histology_and_embryology",
	"neurosurgeon",
	"anesthesiology_and_intensive_care",
	"anatomical_pathology",
	"clinical_biology",
	"medical_oncology",
	"surgical_oncology",
] as const;

function pickRandom<T>(items: T[]): T {
	const i = Math.floor(Math.random() * items.length);
	const v = items[i];
	if (v === undefined) {
		throw new Error("reassign-removed-specialities: empty pool");
	}
	return v;
}

/**
 * For existing DBs: point doctors and applications away from removed specialities, then delete those rows.
 * Safe to run multiple times (no-ops when slugs are already gone).
 */
export async function reassignRemovedSpecialitiesAndDeleteRows(): Promise<{
	profilesUpdated: number;
	applicationsUpdated: number;
	specialitiesDeleted: number;
}> {
	const removed = await db
		.select({ id: speciality.id })
		.from(speciality)
		.where(inArray(speciality.slug, [...REMOVED_SPECIALITY_SLUGS]));

	const removedIds = removed.map((r) => r.id);
	if (removedIds.length === 0) {
		return {
			profilesUpdated: 0,
			applicationsUpdated: 0,
			specialitiesDeleted: 0,
		};
	}

	const pool = await db
		.select({ id: speciality.id })
		.from(speciality)
		.where(notInArray(speciality.slug, [...REMOVED_SPECIALITY_SLUGS]));

	const poolIds = pool.map((p) => p.id);
	if (poolIds.length === 0) {
		throw new Error(
			"reassign-removed-specialities: no replacement specialities in DB; seed specialities first.",
		);
	}

	let profilesUpdated = 0;
	let applicationsUpdated = 0;

	await db.transaction(async (tx) => {
		const profiles = await tx
			.select({ id: doctorProfile.id })
			.from(doctorProfile)
			.where(inArray(doctorProfile.specialityId, removedIds));

		for (const row of profiles) {
			await tx
				.update(doctorProfile)
				.set({ specialityId: pickRandom(poolIds), updatedAt: new Date() })
				.where(eq(doctorProfile.id, row.id));
			profilesUpdated++;
		}

		const applications = await tx
			.select({ id: doctorApplication.id })
			.from(doctorApplication)
			.where(inArray(doctorApplication.specialityId, removedIds));

		for (const row of applications) {
			await tx
				.update(doctorApplication)
				.set({ specialityId: pickRandom(poolIds), updatedAt: new Date() })
				.where(eq(doctorApplication.id, row.id));
			applicationsUpdated++;
		}

		await tx
			.delete(speciality)
			.where(inArray(speciality.slug, [...REMOVED_SPECIALITY_SLUGS]));
	});

	const specialitiesDeleted = removedIds.length;

	return { profilesUpdated, applicationsUpdated, specialitiesDeleted };
}
