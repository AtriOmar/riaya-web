import { db } from "../index";
import { speciality } from "../schema";
import { SPECIALITIES } from "./specialities";

type SpecialitySeed = {
	enName: string;
	frName: string;
	arName: string;
	slug: string;
};

export async function seedSpecialities() {
	const values = (SPECIALITIES as SpecialitySeed[]).map((item) => ({
		enName: item.enName,
		frName: item.frName,
		arName: item.arName,
		slug: item.slug,
	}));

	if (values.length === 0) {
		return [];
	}

	await db
		.insert(speciality)
		.values(values)
		.onConflictDoNothing({ target: speciality.slug });

	return db
		.select({
			id: speciality.id,
			slug: speciality.slug,
		})
		.from(speciality);
}
