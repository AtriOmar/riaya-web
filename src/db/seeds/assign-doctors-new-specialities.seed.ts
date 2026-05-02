import { eq, inArray } from "drizzle-orm";
import { db } from "../index";
import { doctorProfile, speciality } from "../schema";
import { SPECIALITIES } from "./specialities";

/** Must match the entries appended in `specialities.ts` for random assignment. */
export const NEW_SPECIALITY_SLUGS = [
	"physiotherapy",
	"psychology",
	"allergology",
	"vascular_medicine",
	"diabetology",
] as const;

type SpecialitySeedRow = {
	enName: string;
	frName: string;
	arName: string;
	slug: string;
};

function pickRandom<T>(items: readonly T[]): T {
	const i = Math.floor(Math.random() * items.length);
	const v = items[i];
	if (v === undefined) {
		throw new Error("assign-doctors-new-specialities: empty pool");
	}
	return v;
}

function shuffleInPlace<T>(arr: T[]): void {
	for (let i = arr.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		const a = arr[i];
		const b = arr[j];
		if (a === undefined || b === undefined) {
			continue;
		}
		arr[i] = b;
		arr[j] = a;
	}
}

/** Inserts the target specialities if missing, then returns their DB ids. */
export async function ensureNewSpecialitiesInDb(): Promise<number[]> {
	const slugSet = new Set<string>(NEW_SPECIALITY_SLUGS);
	const rows = (SPECIALITIES as SpecialitySeedRow[]).filter((s) =>
		slugSet.has(s.slug),
	);

	if (rows.length !== NEW_SPECIALITY_SLUGS.length) {
		throw new Error(
			"assign-doctors-new-specialities: SPECIALITIES seed is missing some new slugs",
		);
	}

	await db
		.insert(speciality)
		.values(
			rows.map((r) => ({
				enName: r.enName,
				frName: r.frName,
				arName: r.arName,
				slug: r.slug,
			})),
		)
		.onConflictDoNothing({ target: speciality.slug });

	const found = await db
		.select({ id: speciality.id })
		.from(speciality)
		.where(inArray(speciality.slug, [...NEW_SPECIALITY_SLUGS]));

	if (found.length !== NEW_SPECIALITY_SLUGS.length) {
		throw new Error(
			`assign-doctors-new-specialities: expected ${NEW_SPECIALITY_SLUGS.length} speciality rows, found ${found.length}`,
		);
	}

	return found.map((r) => r.id);
}

export type AssignNewSpecialitiesOptions = {
	/** Fraction of all doctors to reassign (default 0.12). */
	fraction?: number;
	maxDoctors?: number;
	minDoctors?: number;
};

/**
 * Picks a random subset of doctors and assigns each a random speciality among the configured new ones.
 */
export async function assignRandomDoctorsToNewSpecialities(
	options?: AssignNewSpecialitiesOptions,
): Promise<{ updated: number; specialityIds: number[] }> {
	const fraction = options?.fraction ?? 0.12;
	const maxDoctors = options?.maxDoctors ?? 500;
	const minDoctors = options?.minDoctors ?? 8;

	const specialityIds = await ensureNewSpecialitiesInDb();

	const profiles = await db
		.select({ id: doctorProfile.id })
		.from(doctorProfile);
	const pickCount = Math.min(
		maxDoctors,
		Math.max(minDoctors, Math.ceil(profiles.length * fraction)),
	);

	const profileIds = profiles.map((p) => p.id);
	shuffleInPlace(profileIds);
	const chosen = profileIds.slice(0, Math.min(pickCount, profileIds.length));

	let updated = 0;
	await db.transaction(async (tx) => {
		for (const profileId of chosen) {
			const specId = pickRandom(specialityIds);
			await tx
				.update(doctorProfile)
				.set({ specialityId: specId, updatedAt: new Date() })
				.where(eq(doctorProfile.id, profileId));
			updated++;
		}
	});

	return { updated, specialityIds };
}
