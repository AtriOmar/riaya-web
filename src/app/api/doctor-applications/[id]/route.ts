import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { user as userTable } from "@/db/auth-schema";
import { doctorApplication, doctorProfile } from "@/db/schema";
import { apiError, json, requireAdmin, validationError } from "@/lib/api-utils";

// ─── GET /api/doctor-applications/[id] ───────────────────────────────────────

export async function GET(
	_req: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	try {
		await requireAdmin();

		const { id } = await params;
		const applicationId = Number(id);
		if (Number.isNaN(applicationId)) return apiError("INVALID_ID");

		const application = await db.query.doctorApplication.findFirst({
			where: eq(doctorApplication.id, applicationId),
			with: {
				user: { columns: { id: true, username: true, email: true } },
				speciality: { columns: { id: true, name: true } },
			},
		});

		if (!application) return apiError("APPLICATION_NOT_FOUND");

		return json(application);
	} catch (e) {
		if (e instanceof Response) return e;
		return apiError("INTERNAL_ERROR");
	}
}

// ─── PUT /api/doctor-applications/[id] ───────────────────────────────────────
// Admin updates an application status (verify / reject / ban)

const updateSchema = z.object({
	status: z.enum(["verified", "rejected", "banned"]),
	rejectionReasons: z.array(z.string()).optional(),
});

export async function PUT(
	req: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	try {
		await requireAdmin();

		const { id } = await params;
		const applicationId = Number(id);
		if (Number.isNaN(applicationId)) return apiError("INVALID_ID");

		const body = await req.json();
		const parsed = updateSchema.safeParse(body);
		if (!parsed.success) return validationError(parsed.error.issues);

		const { status, rejectionReasons } = parsed.data;

		const application = await db.query.doctorApplication.findFirst({
			where: eq(doctorApplication.id, applicationId),
		});

		if (!application?.userId) return apiError("APPLICATION_NOT_FOUND");

		if (status === "verified") {
			// Create / update the doctor profile from the application data
			const existing = await db
				.select()
				.from(doctorProfile)
				.where(eq(doctorProfile.userId, application.userId));

			if (existing.length > 0) {
				await db
					.update(doctorProfile)
					.set({
						firstName: application.firstName,
						lastName: application.lastName,
						cinRecto: application.cinRecto,
						cinVerso: application.cinVerso,
						cabinetName: application.cabinetName,
						cabinetCity: application.cabinetCity,
						cabinetLongitude: application.cabinetLongitude,
						cabinetLatitude: application.cabinetLatitude,
						tin: application.tin,
						specialityId: application.specialityId,
						status: "verified",
						updatedAt: new Date(),
					})
					.where(eq(doctorProfile.userId, application.userId));
			} else {
				await db.insert(doctorProfile).values({
					userId: application.userId,
					firstName: application.firstName,
					lastName: application.lastName,
					cinRecto: application.cinRecto,
					cinVerso: application.cinVerso,
					cabinetName: application.cabinetName,
					cabinetCity: application.cabinetCity,
					cabinetLongitude: application.cabinetLongitude,
					cabinetLatitude: application.cabinetLatitude,
					tin: application.tin,
					specialityId: application.specialityId,
					status: "verified",
				});
			}

			// Update user with name from application
			await db
				.update(userTable)
				.set({
					name: `${application.firstName} ${application.lastName}`,
					username: `${application.firstName} ${application.lastName}`,
				})
				.where(eq(userTable.id, application.userId));

			await db
				.update(doctorApplication)
				.set({ status: "verified", updatedAt: new Date() })
				.where(eq(doctorApplication.id, applicationId));
		} else if (status === "rejected") {
			await db
				.update(doctorProfile)
				.set({ status: "rejected", updatedAt: new Date() })
				.where(eq(doctorProfile.userId, application.userId));

			await db
				.update(doctorApplication)
				.set({ status: "rejected", rejectionReasons, updatedAt: new Date() })
				.where(eq(doctorApplication.id, applicationId));
		} else if (status === "banned") {
			await db
				.update(doctorProfile)
				.set({ status: "banned", updatedAt: new Date() })
				.where(eq(doctorProfile.userId, application.userId));

			await db
				.update(doctorApplication)
				.set({ status: "banned", rejectionReasons, updatedAt: new Date() })
				.where(eq(doctorApplication.id, applicationId));
		}

		return json({ message: "success" });
	} catch (e) {
		if (e instanceof Response) return e;
		return apiError("INTERNAL_ERROR");
	}
}
