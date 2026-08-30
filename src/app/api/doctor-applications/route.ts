import { and, eq, ilike, inArray, or } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { user as userTable } from "@/db/auth-schema";
import { doctorApplication } from "@/db/schema";
import {
	apiError,
	json,
	requireAdmin,
	requireSession,
	validationError,
} from "@/lib/api-utils";

// ─── GET /api/doctor-applications ─────────────────────────────────────────────
// Admin-only: returns all pending applications

const getSchema = z.object({
	status: z.string().optional().default("pending"),
	search: z.string().optional(),
	limit: z.coerce.number().min(1).max(100).default(50),
	page: z.coerce.number().min(1).default(1),
});

export async function GET(req: NextRequest) {
	try {
		await requireAdmin();

		const params = Object.fromEntries(req.nextUrl.searchParams);
		const parsed = getSchema.safeParse(params);
		if (!parsed.success) return validationError(parsed.error.issues);

		const { status, search, limit, page } = parsed.data;

		const applications = await db.query.doctorApplication.findMany({
			where: and(
				status === "all"
					? undefined
					: eq(doctorApplication.status, status as any),
				search
					? or(
							ilike(doctorApplication.firstName, `%${search}%`),
							ilike(doctorApplication.lastName, `%${search}%`),
							inArray(
								doctorApplication.userId,
								db
									.select({ id: userTable.id })
									.from(userTable)
									.where(ilike(userTable.email, `%${search}%`)),
							),
						)
					: undefined,
			),
			orderBy: (t, { desc }) => [desc(t.createdAt)],
			with: {
				user: { columns: { id: true, username: true, email: true } },
			},
			limit: limit,
			offset: (page - 1) * limit,
		});

		return json(applications);
	} catch (e) {
		if (e instanceof Response) return e;
		return apiError("INTERNAL_ERROR");
	}
}

// ─── POST /api/doctor-applications ────────────────────────────────────────────
// Authenticated user creates a doctor application

const createSchema = z.object({
	firstName: z.string().min(1),
	lastName: z.string().min(1),
	cinRecto: z.string().min(1), // URL from R2
	cinVerso: z.string().min(1), // URL from R2
	cabinetName: z.string().min(1),
	cabinetCityId: z.coerce.number().int().positive().optional(),
	cabinetLongitude: z.coerce.number().optional(),
	cabinetLatitude: z.coerce.number().optional(),
	specialityId: z.coerce.number().int().positive(),
	tin: z.string().min(1),
	medicalCouncilNumber: z.string().min(1),
	medicalCouncilCertificate: z.string().min(1),
});

export async function POST(req: NextRequest) {
	try {
		const session = await requireSession();
		const body = await req.json();
		const parsed = createSchema.safeParse(body);

		if (!parsed.success) return validationError(parsed.error.issues);

		// Delete existing application if any
		await db
			.delete(doctorApplication)
			.where(eq(doctorApplication.userId, session.user.id));

		const [application] = await db
			.insert(doctorApplication)
			.values({
				userId: session.user.id,
				firstName: parsed.data.firstName,
				lastName: parsed.data.lastName,
				cinRecto: parsed.data.cinRecto,
				cinVerso: parsed.data.cinVerso,
				cabinetName: parsed.data.cabinetName,
				cabinetCityId: parsed.data.cabinetCityId,
				cabinetLongitude: parsed.data.cabinetLongitude,
				cabinetLatitude: parsed.data.cabinetLatitude,
				specialityId: parsed.data.specialityId,
				tin: parsed.data.tin,
				medicalCouncilNumber: parsed.data.medicalCouncilNumber,
				medicalCouncilCertificate: parsed.data.medicalCouncilCertificate,
				status: "pending",
			})
			.returning();

		// Update user status to pending
		const { user: userTable } = await import("@/db/auth-schema");
		await db
			.update(userTable)
			.set({ active: 1 })
			.where(eq(userTable.id, session.user.id));

		return json(application, 201);
	} catch (e) {
		if (e instanceof Response) return e;
		return apiError("INTERNAL_ERROR");
	}
}

import { selectDoctorApplicationSchema, selectUserSchema } from "@/db/zod";
import { registry } from "@/lib/openapi";

registry.registerPath({
	method: "get",
	path: "/api/doctor-applications",
	tags: ["Doctors"],
	summary: "List doctor applications (Admin)",
	request: { query: getSchema },
	responses: {
		200: {
			description: "List of applications",
			content: {
				"application/json": {
					schema: z.array(
						selectDoctorApplicationSchema.merge(
							z.object({
								user: selectUserSchema.pick({
									id: true,
									username: true,
									email: true,
								}),
							}),
						),
					),
				},
			},
		},
	},
});

registry.registerPath({
	method: "post",
	path: "/api/doctor-applications",
	tags: ["Doctors"],
	summary: "Create doctor application",
	request: {
		body: { content: { "application/json": { schema: createSchema } } },
	},
	responses: {
		201: {
			description: "Created application",
			content: {
				"application/json": { schema: selectDoctorApplicationSchema },
			},
		},
	},
});
