import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { user as userTable } from "@/db/auth-schema";
import { doctorProfile } from "@/db/schema";
import {
	apiError,
	json,
	requireAdmin,
	requireSession,
	validationError,
} from "@/lib/api-utils";

// ─── GET /api/users/[id] ────────────────────────────────────────────────────

export async function GET(
	_req: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	try {
		await requireSession();
		const { id } = await params;

		const [foundUser] = await db
			.select({
				id: userTable.id,
				name: userTable.name,
				email: userTable.email,
				image: userTable.image,
				displayName: userTable.displayName,
				username: userTable.username,
				accessId: userTable.accessId,
				active: userTable.active,
				type: userTable.type,
				createdAt: userTable.createdAt,
			})
			.from(userTable)
			.where(eq(userTable.id, id));

		if (!foundUser) return apiError("USER_NOT_FOUND");

		// Also fetch doctor profile with speciality if it exists
		const doctorProfileData = await db.query.doctorProfile.findFirst({
			where: eq(doctorProfile.userId, id),
			with: { speciality: true },
		});

		return json({ ...foundUser, doctorProfile: doctorProfileData ?? null });
	} catch (e) {
		if (e instanceof Response) return e;
		return apiError("INTERNAL_ERROR");
	}
}

// ─── PUT /api/users/[id] ────────────────────────────────────────────────────
// Admin-only: update a user's status or access level

const adminUpdateSchema = z.object({
	status: z.string().optional(),
	accessId: z.number().optional(),
});

export async function PUT(
	req: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	try {
		await requireAdmin();
		const { id } = await params;
		const body = await req.json();
		const parsed = adminUpdateSchema.safeParse(body);

		if (!parsed.success) return validationError(parsed.error.issues);

		const { status, accessId } = parsed.data;

		// Update user-level fields
		if (accessId !== undefined) {
			await db.update(userTable).set({ accessId }).where(eq(userTable.id, id));
		}

		// Update doctor profile status if provided
		if (status !== undefined) {
			await db
				.update(doctorProfile)
				.set({ status, updatedAt: new Date() })
				.where(eq(doctorProfile.userId, id));
		}

		const [updatedUser] = await db
			.select({
				id: userTable.id,
				name: userTable.name,
				email: userTable.email,
				accessId: userTable.accessId,
				active: userTable.active,
			})
			.from(userTable)
			.where(eq(userTable.id, id));

		if (!updatedUser) return apiError("USER_NOT_FOUND");

		return json(updatedUser);
	} catch (e) {
		if (e instanceof Response) return e;
		return apiError("INTERNAL_ERROR");
	}
}
