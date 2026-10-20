import { eq, or } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { speciality } from "@/db/schema";
import { apiError, json, requireAdmin, validationError } from "@/lib/api-utils";
import { calculateHaversineKm, listFinderDoctors } from "@/lib/best-fit";

// ─── GET /api/doctors/best-fit/map ───────────────────────────────────────────
// Admin-only. Doctors for the Best Fit map: no dates or slots, just who is in
// the speciality and near the location. `speciality` and the `lat`/`long` pair
// are optional; without a location `distance` is null.

const schema = z.object({
	speciality: z.string().min(1).optional(),
	long: z.coerce.number().optional(),
	lat: z.coerce.number().optional(),
});

export async function GET(req: NextRequest) {
	try {
		await requireAdmin();
		const parsed = schema.safeParse(
			Object.fromEntries(req.nextUrl.searchParams),
		);
		if (!parsed.success) return validationError(parsed.error.issues);

		const term = parsed.data.speciality;
		const location =
			parsed.data.lat != null &&
			parsed.data.long != null &&
			Number.isFinite(parsed.data.lat) &&
			Number.isFinite(parsed.data.long)
				? { lat: parsed.data.lat, long: parsed.data.long }
				: null;

		let specialityId: number | null = null;
		if (term) {
			const [found] = await db
				.select()
				.from(speciality)
				.where(
					or(
						eq(speciality.slug, term),
						eq(speciality.enName, term),
						eq(speciality.frName, term),
						eq(speciality.arName, term),
					),
				);
			if (!found) return apiError("SPECIALITY_NOT_FOUND");
			specialityId = found.id;
		}

		const doctors = await listFinderDoctors({ specialityId, location });

		return json(
			doctors.map((d) => ({
				id: d.id,
				userId: d.userId,
				firstName: d.firstName,
				lastName: d.lastName,
				cabinetName: d.cabinetName,
				cabinetCityId: d.cabinetCityId,
				cabinetLatitude: d.cabinetLatitude,
				cabinetLongitude: d.cabinetLongitude,
				specialityId: d.specialityId,
				address: d.address ?? null,
				distance: location
					? calculateHaversineKm(
							location.lat,
							location.long,
							d.cabinetLatitude as number,
							d.cabinetLongitude as number,
						)
					: null,
			})),
		);
	} catch (e) {
		if (e instanceof Response) return e;
		return apiError("INTERNAL_ERROR");
	}
}

import { selectBestFitDoctorSchema } from "@/db/zod";
import { registry } from "@/lib/openapi";

const mapDoctorSchema = selectBestFitDoctorSchema
	.omit({ nextSlot: true, nearbySlots: true, distance: true })
	.merge(z.object({ distance: z.number().nullable() }));

registry.registerPath({
	method: "get",
	path: "/api/doctors/best-fit/map",
	tags: ["Doctors"],
	summary: "Doctors for the Best Fit map, regardless of availability (Admin)",
	request: { query: schema },
	responses: {
		200: {
			description: "Doctors in the speciality and near the location",
			content: { "application/json": { schema: z.array(mapDoctorSchema) } },
		},
	},
});
