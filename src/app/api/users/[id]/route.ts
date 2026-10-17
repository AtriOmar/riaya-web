import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { user as userTable } from "@/db/auth-schema";
import { doctorProfile } from "@/db/schema";
import {
	selectDoctorProfileWithRelationsSchema,
	selectUserSchema,
} from "@/db/zod";
import { apiError, json, requireAdmin, validationError } from "@/lib/api-utils";
import { registry } from "@/lib/openapi";

/** Loads a user with their doctor profile (null for non-doctors). */
async function findUserDetail(id: string) {
	const [foundUser] = await db
		.select({
			id: userTable.id,
			name: userTable.name,
			email: userTable.email,
			image: userTable.image,
			displayName: userTable.displayName,
			username: userTable.username,
			accessId: userTable.accessId,
			createdAt: userTable.createdAt,
		})
		.from(userTable)
		.where(eq(userTable.id, id));

	if (!foundUser) return null;

	const profile = await db.query.doctorProfile.findFirst({
		where: eq(doctorProfile.userId, id),
		with: { speciality: true, cabinetCity: true },
	});

	return { ...foundUser, doctorProfile: profile ?? null };
}

// ─── GET /api/users/[id] ────────────────────────────────────────────────────
// Admin-only: a user with their doctor profile

export async function GET(
	_req: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	try {
		await requireAdmin();
		const { id } = await params;

		const detail = await findUserDetail(id);
		if (!detail) return apiError("USER_NOT_FOUND");

		return json(detail);
	} catch (e) {
		if (e instanceof Response) return e;
		return apiError("INTERNAL_ERROR");
	}
}

// ─── PUT /api/users/[id] ────────────────────────────────────────────────────
// Admin-only: change a user's role, or ban / unban their doctor account

const adminUpdateSchema = z.object({
	/** 1 = Doctor, 3 = Admin, 5 = Owner */
	accessId: z.union([z.literal(1), z.literal(3), z.literal(5)]).optional(),
	/** Bans the doctor profile; unbanning restores it to verified. */
	banned: z.boolean().optional(),
});

export async function PUT(
	req: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	try {
		const session = await requireAdmin();
		const { id } = await params;
		const parsed = adminUpdateSchema.safeParse(await req.json());
		if (!parsed.success) return validationError(parsed.error.issues);

		// Admins can't lock themselves out by demoting or banning their own account
		if (id === session.user.id) return apiError("FORBIDDEN");

		const { accessId, banned } = parsed.data;

		const existing = await findUserDetail(id);
		if (!existing) return apiError("USER_NOT_FOUND");

		if (accessId !== undefined) {
			await db.update(userTable).set({ accessId }).where(eq(userTable.id, id));
		}

		if (banned !== undefined) {
			if (!existing.doctorProfile) return apiError("DOCTOR_PROFILE_NOT_FOUND");
			await db
				.update(doctorProfile)
				.set({ status: banned ? "banned" : "verified", updatedAt: new Date() })
				.where(eq(doctorProfile.userId, id));
		}

		return json(await findUserDetail(id));
	} catch (e) {
		if (e instanceof Response) return e;
		return apiError("INTERNAL_ERROR");
	}
}

const paramsSchema = z.object({ id: z.string() });

const userDetailSchema = selectUserSchema
	.pick({
		id: true,
		name: true,
		email: true,
		image: true,
		displayName: true,
		username: true,
		accessId: true,
		createdAt: true,
	})
	.merge(
		z.object({
			doctorProfile: selectDoctorProfileWithRelationsSchema.nullable(),
		}),
	);

registry.registerPath({
	method: "get",
	path: "/api/users/{id}",
	tags: ["Users"],
	summary: "Get user by ID (Admin)",
	request: { params: paramsSchema },
	responses: {
		200: {
			description: "User with doctor profile",
			content: { "application/json": { schema: userDetailSchema } },
		},
	},
});

registry.registerPath({
	method: "put",
	path: "/api/users/{id}",
	tags: ["Users"],
	summary: "Update user role or ban status (Admin)",
	request: {
		params: paramsSchema,
		body: { content: { "application/json": { schema: adminUpdateSchema } } },
	},
	responses: {
		200: {
			description: "Updated user with doctor profile",
			content: { "application/json": { schema: userDetailSchema } },
		},
	},
});
