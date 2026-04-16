import { db } from "../index";
import { cities } from "../schema";
import { CITIES } from "./cities";

type CitySeed = {
	postalCode: number | null;
	latitude: number | null;
	longitude: number | null;
	enName: string;
	frName: string;
	arName: string;
	slug: string;
};

export async function seedCities() {
	const values = (CITIES as CitySeed[]).map((city) => ({
		postalCode: city.postalCode ?? null,
		latitude: city.latitude ?? null,
		longitude: city.longitude ?? null,
		enName: city.enName,
		frName: city.frName,
		arName: city.arName,
		slug: city.slug,
	}));

	if (values.length === 0) {
		return [];
	}

	await db
		.insert(cities)
		.values(values)
		.onConflictDoNothing({ target: cities.slug });

	return db
		.select({
			id: cities.id,
			slug: cities.slug,
			latitude: cities.latitude,
			longitude: cities.longitude,
		})
		.from(cities);
}
