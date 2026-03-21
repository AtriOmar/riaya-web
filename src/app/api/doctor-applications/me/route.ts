import { eq } from "drizzle-orm";
import { db } from "@/db";
import { doctorApplication } from "@/db/schema";
import { apiError, json, requireSession } from "@/lib/api-utils";

// ─── GET /api/doctor-applications/me ─────────────────────────────────────────
// Returns the authenticated user's own doctor application

export async function GET() {
  try {
    const session = await requireSession();

    const application = await db.query.doctorApplication.findFirst({
      where: eq(doctorApplication.userId, session.user.id),
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
