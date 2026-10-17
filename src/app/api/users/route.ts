import { and, asc, desc, eq, ilike, ne, or, sql } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { user as userTable } from "@/db/auth-schema";
import { doctorProfile, subscription } from "@/db/schema";
import {
	apiError,
	json,
	requireSession,
	validationError,
} from "@/lib/api-utils";
import { resolvePlanId } from "@/lib/plan-limits";
import { PLAN_IDS } from "@/lib/plans";

// ─── GET /api/users ──────────────────────────────────────────────────────────
// Admin: search all users

const getSchema = z.object({
	search: z.string().optional(),
	role: z.enum(["doctor", "admin", "owner"]).optional(),
	status: z.enum(["active", "banned"]).optional(),
	sort: z
		.enum(["newest", "oldest", "email_asc", "email_desc", "name_asc"])
		.default("newest"),
	limit: z.coerce.number().min(1).max(100).default(50),
	page: z.coerce.number().min(1).default(1),
});

export async function GET(req: NextRequest) {
	try {
		const session = await requireSession();

		if (!session.user.accessId || session.user.accessId < 3) {
			return apiError("FORBIDDEN");
		}

		const params = Object.fromEntries(req.nextUrl.searchParams);
		const parsed = getSchema.safeParse(params);
		if (!parsed.success) return validationError(parsed.error.issues);

		const { search, role, status, sort, limit, page } = parsed.data;

		const orderBy = {
			newest: [desc(userTable.createdAt), desc(userTable.id)],
			oldest: [asc(userTable.createdAt), asc(userTable.id)],
			email_asc: [asc(userTable.email), asc(userTable.id)],
			email_desc: [desc(userTable.email), asc(userTable.id)],
			name_asc: [
				sql`lower(coalesce(${userTable.displayName}, ${userTable.name})) asc nulls last`,
				asc(userTable.id),
			],
		}[sort];

		const roleAccessId = { doctor: 1, admin: 3, owner: 5 } as const;

		const users = await db
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
				subscription: subscription,
				hasDoctorProfile:
					sql<boolean>`CASE WHEN ${doctorProfile.id} IS NOT NULL THEN TRUE ELSE FALSE END`.as(
						"hasDoctorProfile",
					),
			})
			.from(userTable)
			.leftJoin(doctorProfile, eq(doctorProfile.userId, userTable.id))
			.leftJoin(subscription, eq(subscription.doctorId, doctorProfile.id))
			.where(
				and(
					search
						? or(
								ilike(userTable.email, `%${search}%`),
								ilike(userTable.name, `%${search}%`),
								ilike(userTable.username, `%${search}%`),
							)
						: undefined,
					role ? eq(userTable.accessId, roleAccessId[role]) : undefined,
					status
						? (status === "banned" ? eq : ne)(userTable.active, 0)
						: undefined,
				),
			)
			.orderBy(...orderBy)
			.limit(limit)
			.offset((page - 1) * limit);

		// Plan only applies to doctors; non-doctor users get null
		return json(
			users.map(({ subscription: sub, ...user }) => ({
				...user,
				plan: user.hasDoctorProfile ? resolvePlanId(sub) : null,
			})),
		);
	} catch (e) {
		if (e instanceof Response) return e;
		return apiError("INTERNAL_ERROR");
	}
}

// ─── PUT /api/users ──────────────────────────────────────────────────────────
// Authenticated user updates their own profile (availability)

const availabilitySlotSchema = z.object({ start: z.number(), end: z.number() });

const updateSchema = z.object({
	availability: z.object({
		0: z.array(availabilitySlotSchema).optional(),
		1: z.array(availabilitySlotSchema).optional(),
		2: z.array(availabilitySlotSchema).optional(),
		3: z.array(availabilitySlotSchema).optional(),
		4: z.array(availabilitySlotSchema).optional(),
		5: z.array(availabilitySlotSchema).optional(),
		6: z.array(availabilitySlotSchema).optional(),
	}),
});

export async function PUT(req: NextRequest) {
	try {
		const session = await requireSession();
		const body = await req.json();
		const parsed = updateSchema.safeParse(body);

		if (!parsed.success) return validationError(parsed.error.issues);

		const [updated] = await db
			.update(doctorProfile)
			.set({ availability: parsed.data.availability, updatedAt: new Date() })
			.where(eq(doctorProfile.userId, session.user.id))
			.returning();

		if (!updated) return apiError("DOCTOR_PROFILE_NOT_FOUND");

		return json(updated);
	} catch (e) {
		if (e instanceof Response) return e;
		return apiError("INTERNAL_ERROR");
	}
}

import { selectUserSchema } from "@/db/zod";
import { registry } from "@/lib/openapi";

const userRowSchema = selectUserSchema.merge(
	z.object({
		hasDoctorProfile: z.boolean(),
		plan: z.enum(PLAN_IDS).nullable(),
	}),
);

registry.registerPath({
	method: "get",
	path: "/api/users",
	tags: ["Users"],
	summary: "List users (Admin)",
	request: { query: getSchema },
	responses: {
		200: {
			description: "List of users",
			content: { "application/json": { schema: z.array(userRowSchema) } },
		},
	},
});

registry.registerPath({
	method: "put",
	path: "/api/users",
	tags: ["Users"],
	summary: "Update user (Admin)",
	request: {
		body: { content: { "application/json": { schema: updateSchema } } },
	},
	responses: {
		200: {
			description: "Updated user",
			content: {
				"application/json": {
					schema: selectUserSchema.pick({
						id: true,
						name: true,
						email: true,
						accessId: true,
						active: true,
					}),
				},
			},
		},
	},
});
