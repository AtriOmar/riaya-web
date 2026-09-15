import type { NextRequest } from "next/server";
import { z } from "zod";
import { selectBestFitDoctorSchema } from "@/db/zod";
import { apiError, json, validationError } from "@/lib/api-utils";
import { findBestFitDoctors, resolveSpeciality } from "@/lib/best-fit";
import { registry } from "@/lib/openapi";

// ─── GET /api/doctors/best-fit ────────────────────────────────────────────────
// Public endpoint — finds best-fit doctors based on speciality, location, and time

const schema = z.object({
	speciality: z.string().min(1),
	long: z.coerce.number(),
	lat: z.coerce.number(),
	time: z.string().optional(),
});

export async function GET(req: NextRequest) {
	try {
		const searchParams = Object.fromEntries(req.nextUrl.searchParams);
		const parsed = schema.safeParse(searchParams);

		if (!parsed.success) return validationError(parsed.error.issues);

		const {
			speciality: specialitySearchTerm,
			long,
			lat,
			time: desiredTimeParam,
		} = parsed.data;
		const currentTime = new Date();
		let desiredTime: Date;
		if (desiredTimeParam) {
			desiredTime = new Date(desiredTimeParam);
			if (Number.isNaN(desiredTime.getTime()) || desiredTime < currentTime) {
				return apiError("INVALID_DESIRED_TIME");
			}
		} else {
			desiredTime = currentTime;
		}

		const specialityData = await resolveSpeciality(specialitySearchTerm);
		if (!specialityData) return apiError("SPECIALITY_NOT_FOUND");

		const ranked = await findBestFitDoctors({
			specialityId: specialityData.id,
			lat,
			long,
			desiredTime,
			currentTime,
		});

		const processedDoctors = ranked.map((doc) => ({
			id: doc.id,
			userId: doc.userId,
			firstName: doc.firstName,
			lastName: doc.lastName,
			cabinetName: doc.cabinetName,
			cabinetCityId: doc.cabinetCityId,
			cabinetLatitude: doc.cabinetLatitude,
			cabinetLongitude: doc.cabinetLongitude,
			specialityId: doc.specialityId,
			address: doc.address,
			distance: doc.distance,
			nextSlot: {
				start: doc.nextSlot.start.toISOString(),
				end: doc.nextSlot.end.toISOString(),
			},
			nearbySlots: doc.nearbySlots.map((s) => ({
				start: s.start.toISOString(),
				end: s.end.toISOString(),
			})),
		}));

		return json(processedDoctors);
	} catch (e) {
		if (e instanceof Response) return e;
		return apiError("INTERNAL_ERROR");
	}
}

registry.registerPath({
	method: "get",
	path: "/api/doctors/best-fit",
	tags: ["Doctors"],
	summary: "Find best fit doctors",
	request: { query: schema },
	responses: {
		200: {
			description: "List of best fit doctors",
			content: {
				"application/json": { schema: z.array(selectBestFitDoctorSchema) },
			},
		},
	},
});
