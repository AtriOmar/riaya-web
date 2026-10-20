import { and, eq, ilike, sql } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { doctorProfile, speciality } from "@/db/schema";
import { apiError, json, validationError } from "@/lib/api-utils";
import { registry } from "@/lib/openapi";

// ─── GET /api/doctors/search ──────────────────────────────────────────────────
// Public endpoint — find verified doctors by name (used by the phone AI when a
// patient asks for a specific doctor).

const schema = z.object({
	name: z.string().trim().min(2).max(100),
	limit: z.coerce.number().int().min(1).max(10).optional(),
});

const responseSchema = z.object({
	doctors: z.array(
		z.object({
			id: z.number().int(),
			firstName: z.string().nullable(),
			lastName: z.string().nullable(),
			cabinetName: z.string().nullable(),
			address: z.string().nullable(),
			specialitySlug: z.string().nullable(),
			speciality: z.string().nullable(),
		}),
	),
});

registry.registerPath({
	method: "get",
	path: "/api/doctors/search",
	tags: ["Doctors"],
	summary: "Search verified doctors by name",
	request: { query: schema },
	responses: {
		200: {
			description: "Matching doctors",
			content: { "application/json": { schema: responseSchema } },
		},
	},
});

const TITLE_TOKENS = new Set(["dr", "dr.", "doctor", "docteur", "doc"]);

function escapeLike(token: string): string {
	return token.replace(/[\\%_]/g, "\\$&");
}

export async function GET(req: NextRequest) {
	try {
		const parsed = schema.safeParse(
			Object.fromEntries(req.nextUrl.searchParams),
		);
		if (!parsed.success) return validationError(parsed.error.issues);

		const tokens = parsed.data.name
			.toLowerCase()
			.split(/\s+/)
			.filter((t) => t.length > 0 && !TITLE_TOKENS.has(t));
		if (tokens.length === 0) return json({ doctors: [] });

		// Every token must appear in first name, last name or cabinet name.
		const haystack = sql`concat_ws(' ', ${doctorProfile.firstName}, ${doctorProfile.lastName}, ${doctorProfile.cabinetName})`;
		const tokenClauses = tokens.map((t) =>
			ilike(haystack, `%${escapeLike(t)}%`),
		);

		const rows = await db
			.select({
				id: doctorProfile.id,
				firstName: doctorProfile.firstName,
				lastName: doctorProfile.lastName,
				cabinetName: doctorProfile.cabinetName,
				address: doctorProfile.address,
				specialitySlug: speciality.slug,
				speciality: speciality.enName,
			})
			.from(doctorProfile)
			.leftJoin(speciality, eq(doctorProfile.specialityId, speciality.id))
			.where(and(eq(doctorProfile.status, "verified"), ...tokenClauses))
			.limit(parsed.data.limit ?? 5);

		return json({ doctors: rows });
	} catch (e) {
		if (e instanceof Response) return e;
		return apiError("INTERNAL_ERROR");
	}
}
