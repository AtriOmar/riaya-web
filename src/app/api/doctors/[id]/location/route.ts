import { eq, isNotNull } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { cities, doctorProfile } from "@/db/schema";
import { apiError, json, requireAdmin, validationError } from "@/lib/api-utils";

// ─── PATCH /api/doctors/[id]/location ─────────────────────────────────────────
// Admin-only. Moves a doctor's cabinet pin on the map. The written address is
// left as it is; the cabinet city is set to the nearest known city.

/** Beyond this the nearest city is probably not the right one, so keep the old. */
const MAX_CITY_DISTANCE_KM = 40;

function distanceKm(
	a: { lat: number; lng: number },
	b: { lat: number; lng: number },
) {
	const rad = Math.PI / 180;
	const dLat = (b.lat - a.lat) * rad;
	const dLng = (b.lng - a.lng) * rad;
	const h =
		Math.sin(dLat / 2) ** 2 +
		Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
	return 12742 * Math.asin(Math.sqrt(h));
}

async function nearestCity(point: { lat: number; lng: number }) {
	const rows = await db
		.select({
			id: cities.id,
			frName: cities.frName,
			enName: cities.enName,
			latitude: cities.latitude,
			longitude: cities.longitude,
		})
		.from(cities)
		.where(isNotNull(cities.latitude));

	let best: { id: number; name: string | null; km: number } | null = null;
	for (const c of rows) {
		if (c.latitude == null || c.longitude == null) continue;
		const km = distanceKm(point, { lat: c.latitude, lng: c.longitude });
		if (!best || km < best.km) {
			best = { id: c.id, name: c.frName ?? c.enName, km };
		}
	}
	return best && best.km <= MAX_CITY_DISTANCE_KM ? best : null;
}

const bodySchema = z.object({
	latitude: z.number().min(-90).max(90),
	longitude: z.number().min(-180).max(180),
});

export async function PATCH(
	req: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	try {
		await requireAdmin();
		const { id } = await params;
		const numericId = Number(id);
		if (!Number.isFinite(numericId)) return apiError("INVALID_ID");

		const parsed = bodySchema.safeParse(await req.json());
		if (!parsed.success) return validationError(parsed.error.issues);

		const city = await nearestCity({
			lat: parsed.data.latitude,
			lng: parsed.data.longitude,
		});

		const [updated] = await db
			.update(doctorProfile)
			.set({
				cabinetLatitude: parsed.data.latitude,
				cabinetLongitude: parsed.data.longitude,
				...(city ? { cabinetCityId: city.id } : {}),
			})
			.where(eq(doctorProfile.id, numericId))
			.returning({
				id: doctorProfile.id,
				cabinetLatitude: doctorProfile.cabinetLatitude,
				cabinetLongitude: doctorProfile.cabinetLongitude,
				cabinetCityId: doctorProfile.cabinetCityId,
			});

		if (!updated) return apiError("DOCTOR_NOT_FOUND");

		// cityName is null when no city was close enough and the old one was kept.
		return json({ ...updated, cityName: city?.name ?? null });
	} catch (e) {
		if (e instanceof Response) return e;
		return apiError("INTERNAL_ERROR");
	}
}

import { selectDoctorProfileSchema } from "@/db/zod";
import { registry } from "@/lib/openapi";

const paramsSchema = z.object({ id: z.string() });

registry.registerPath({
	method: "patch",
	path: "/api/doctors/{id}/location",
	tags: ["Doctors"],
	summary: "Update a doctor's cabinet coordinates (Admin)",
	request: {
		params: paramsSchema,
		body: { content: { "application/json": { schema: bodySchema } } },
	},
	responses: {
		200: {
			description: "Updated coordinates",
			content: {
				"application/json": {
					schema: selectDoctorProfileSchema
						.pick({
							id: true,
							cabinetLatitude: true,
							cabinetLongitude: true,
							cabinetCityId: true,
						})
						.extend({ cityName: z.string().nullable() }),
				},
			},
		},
	},
});
