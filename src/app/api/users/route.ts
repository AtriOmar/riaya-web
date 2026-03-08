import { db } from "@/db";
import { doctorProfile } from "@/db/schema";
import { user as userTable } from "@/db/auth-schema";
import { json, apiError, validationError, requireSession } from "@/lib/api-utils";
import { eq, or, ilike } from "drizzle-orm";
import { z } from "zod";
import type { NextRequest } from "next/server";

// ─── GET /api/users ──────────────────────────────────────────────────────────
// Admin: search all users

const getSchema = z.object({
  search: z.string().optional(),
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

    const search = parsed.data.search;

    let users;
    if (search) {
      users = await db
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
        .where(
          or(
            ilike(userTable.email, `%${search}%`),
            ilike(userTable.name, `%${search}%`),
            ilike(userTable.username, `%${search}%`),
          ),
        );
    } else {
      users = await db
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
        .from(userTable);
    }

    return json(users);
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
