import { eq } from "drizzle-orm";
import { db } from "@/db";
import { user as userTable } from "@/db/auth-schema";
import { doctorProfile } from "@/db/schema";
import { apiError, json, requireSession } from "@/lib/api-utils";

// ─── GET /api/users/me ───────────────────────────────────────────────────────
// Authenticated user: same shape as GET /api/users/[id] for the current session user

export async function GET() {
	try {
		const session = await requireSession();
		const id = session.user.id;

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

		const doctorProfileData = await db.query.doctorProfile.findFirst({
			where: eq(doctorProfile.userId, id),
			with: { speciality: true, cabinetCity: true },
		});

		return json({ ...foundUser, doctorProfile: doctorProfileData ?? null });
	} catch (e) {
		if (e instanceof Response) return e;
		return apiError("INTERNAL_ERROR");
	}
}
