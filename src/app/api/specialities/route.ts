import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { doctorProfile, speciality } from "@/db/schema";
import { apiError, json, requireAdmin, validationError } from "@/lib/api-utils";
import { toSlug } from "@/lib/stringUtils";

// ─── GET /api/specialities ───────────────────────────────────────────────────

export async function GET() {
	try {
		const specialities = await db.select().from(speciality);
		return json(specialities);
	} catch {
		return apiError("INTERNAL_ERROR");
	}
}

// ─── POST /api/specialities ──────────────────────────────────────────────────

const createSchema = z.object({
	enName: z.string().min(1),
	frName: z.string().min(1),
	arName: z.string().min(1),
	slug: z.string().min(1).optional(),
});

export async function POST(req: NextRequest) {
	try {
		await requireAdmin();
		const body = await req.json();
		const parsed = createSchema.safeParse(body);
		if (!parsed.success) return validationError(parsed.error.issues);

		const [created] = await db
			.insert(speciality)
			.values({
				enName: parsed.data.enName,
				frName: parsed.data.frName,
				arName: parsed.data.arName,
				slug: parsed.data.slug
					? toSlug(parsed.data.slug)
					: toSlug(parsed.data.enName),
			})
			.returning();
		return json(created, 201);
	} catch (e) {
		if (e instanceof Response) return e;
		return apiError("INTERNAL_ERROR");
	}
}

// ─── PUT /api/specialities ───────────────────────────────────────────────────

const updateSchema = z.object({
	id: z.coerce.number().int().positive(),
	enName: z.string().min(1),
	frName: z.string().min(1),
	arName: z.string().min(1),
	slug: z.string().min(1).optional(),
});

export async function PUT(req: NextRequest) {
	try {
		await requireAdmin();
		const body = await req.json();
		const parsed = updateSchema.safeParse(body);
		if (!parsed.success) return validationError(parsed.error.issues);

		const [updated] = await db
			.update(speciality)
			.set({
				enName: parsed.data.enName,
				frName: parsed.data.frName,
				arName: parsed.data.arName,
				slug: parsed.data.slug
					? toSlug(parsed.data.slug)
					: toSlug(parsed.data.enName),
			})
			.where(eq(speciality.id, parsed.data.id))
			.returning();

		if (!updated) return apiError("SPECIALITY_NOT_FOUND");

		return json(updated);
	} catch (e) {
		if (e instanceof Response) return e;
		return apiError("INTERNAL_ERROR");
	}
}

// ─── DELETE /api/specialities ────────────────────────────────────────────────
// Requires a replacement speciality ID to reassign doctors before deleting

const deleteSchema = z.object({
	id: z.coerce.number().int().positive(),
	newSpecialityId: z.coerce.number().int().positive(),
});

export async function DELETE(req: NextRequest) {
	try {
		await requireAdmin();
		const searchParams = Object.fromEntries(req.nextUrl.searchParams);
		const parsed = deleteSchema.safeParse(searchParams);
		if (!parsed.success) return validationError(parsed.error.issues);

		const { id, newSpecialityId } = parsed.data;

		// Reassign doctors from deleted speciality to new one
		await db
			.update(doctorProfile)
			.set({ specialityId: newSpecialityId })
			.where(eq(doctorProfile.specialityId, id));

		const [deleted] = await db
			.delete(speciality)
			.where(eq(speciality.id, id))
			.returning();

		if (!deleted) return apiError("SPECIALITY_NOT_FOUND");

		return json({ message: "Speciality deleted successfully" });
	} catch (e) {
		if (e instanceof Response) return e;
		return apiError("INTERNAL_ERROR");
	}
}
