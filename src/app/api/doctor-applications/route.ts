import { db } from "@/db";
import { doctorApplication } from "@/db/schema";
import { json, apiError, validationError, requireSession, requireAdmin } from "@/lib/api-utils";
import { eq } from "drizzle-orm";
import { z } from "zod";
import type { NextRequest } from "next/server";

// ─── GET /api/doctor-applications ─────────────────────────────────────────────
// Admin-only: returns all pending applications

export async function GET() {
  try {
    await requireAdmin();

    const applications = await db.query.doctorApplication.findMany({
      where: eq(doctorApplication.status, "pending"),
      orderBy: (t, { asc }) => [asc(t.createdAt)],
      with: {
        user: { columns: { id: true, username: true, email: true } },
      },
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
  cabinetCity: z.string().optional(),
  cabinetLongitude: z.coerce.number().optional(),
  cabinetLatitude: z.coerce.number().optional(),
  specialityId: z.coerce.number().int().positive(),
  tin: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
    const body = await req.json();
    const parsed = createSchema.safeParse(body);

    if (!parsed.success) return validationError(parsed.error.issues);

    // Delete existing application if any
    await db.delete(doctorApplication).where(eq(doctorApplication.userId, session.user.id));

    const [application] = await db
      .insert(doctorApplication)
      .values({
        userId: session.user.id,
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        cinRecto: parsed.data.cinRecto,
        cinVerso: parsed.data.cinVerso,
        cabinetName: parsed.data.cabinetName,
        cabinetCity: parsed.data.cabinetCity,
        cabinetLongitude: parsed.data.cabinetLongitude,
        cabinetLatitude: parsed.data.cabinetLatitude,
        specialityId: parsed.data.specialityId,
        tin: parsed.data.tin,
        status: "pending",
      })
      .returning();

    // Update user status to pending
    const { user: userTable } = await import("@/db/auth-schema");
    await db.update(userTable).set({ active: 1 }).where(eq(userTable.id, session.user.id));

    return json(application, 201);
  } catch (e) {
    if (e instanceof Response) return e;
    return apiError("INTERNAL_ERROR");
  }
}
