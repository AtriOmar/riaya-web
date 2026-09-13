import { eq, sql } from "drizzle-orm";
import {
	CityLocationAllocator,
	hasCityBounds,
} from "../../lib/tunisia-city-bounds";
import { db } from "../index";
import { cities, doctorProfile } from "../schema";

type LocationUpdate = {
	id: number;
	userId: string;
	lat: number;
	lng: number;
};

export async function randomizeDoctorLocations() {
	const profiles = await db
		.select({
			id: doctorProfile.id,
			userId: doctorProfile.userId,
			citySlug: cities.slug,
		})
		.from(doctorProfile)
		.leftJoin(cities, eq(doctorProfile.cabinetCityId, cities.id));

	const allocator = new CityLocationAllocator();
	const updates: LocationUpdate[] = [];
	let skipped = 0;

	for (const profile of profiles) {
		const slug = profile.citySlug?.trim().toLowerCase() ?? "";
		if (!hasCityBounds(slug)) {
			skipped += 1;
			continue;
		}

		const point = allocator.next(slug);
		updates.push({
			id: profile.id,
			userId: profile.userId,
			lat: point.lat,
			lng: point.lng,
		});
	}

	if (updates.length === 0) {
		return {
			totalProfiles: profiles.length,
			updatedProfiles: 0,
			updatedApplications: 0,
			skipped,
		};
	}

	const valuesSql = sql.join(
		updates.map(
			(row) =>
				sql`(${row.id}::int, ${row.userId}::text, ${row.lat}::float8, ${row.lng}::float8)`,
		),
		sql`, `,
	);

	await db.execute(sql`
		UPDATE doctor_profile AS dp
		SET
			cabinet_latitude = v.lat,
			cabinet_longitude = v.lng,
			updated_at = NOW()
		FROM (VALUES ${valuesSql}) AS v(id, user_id, lat, lng)
		WHERE dp.id = v.id
	`);

	const applicationResult = await db.execute(sql`
		UPDATE doctor_application AS da
		SET
			cabinet_latitude = v.lat,
			cabinet_longitude = v.lng,
			updated_at = NOW()
		FROM (VALUES ${valuesSql}) AS v(id, user_id, lat, lng)
		WHERE da.user_id = v.user_id
	`);

	return {
		totalProfiles: profiles.length,
		updatedProfiles: updates.length,
		updatedApplications: applicationResult.rowCount ?? 0,
		skipped,
	};
}
