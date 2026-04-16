import { eq } from "drizzle-orm";
import { db } from "@/db";
import { doctorApplication } from "@/db/schema";
import { apiError, json, requireSession } from "@/lib/api-utils";

// ─── GET /api/doctor-applications/me ─────────────────────────────────────────
// Returns the authenticated user's own doctor application

export async function GET() {
	try {
		const session = await requireSession();

		console.log("-------------------- session --------------------");
		console.log(session);

		const application = await db.query.doctorApplication.findFirst({
			where: eq(doctorApplication.userId, session.user.id),
			with: {
				user: { columns: { id: true, username: true, email: true } },
				speciality: {
					columns: {
						id: true,
						enName: true,
						frName: true,
						arName: true,
						slug: true,
					},
				},
				cabinetCity: {
					columns: {
						id: true,
						postalCode: true,
						enName: true,
						frName: true,
						arName: true,
						slug: true,
					},
				},
			},
		});

		if (!application) return apiError("APPLICATION_NOT_FOUND");

		return json(application);
	} catch (e) {
		if (e instanceof Response) return e;
		return apiError("INTERNAL_ERROR");
	}
}
