import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { user as userTable } from "@/db/auth-schema";
import {
  apiError,
  json,
  requireSession,
  validationError,
} from "@/lib/api-utils";

// ─── PUT /api/users/picture ──────────────────────────────────────────────────
// Updates the user's profile picture URL (already uploaded to R2 via signed URL)

const updatePictureSchema = z.object({
  pictureUrl: z.url(),
});

export async function PUT(req: NextRequest) {
  try {
    const session = await requireSession();
    const body = await req.json();
    const parsed = updatePictureSchema.safeParse(body);

    if (!parsed.success) return validationError(parsed.error.issues);

    await db
      .update(userTable)
      .set({ image: parsed.data.pictureUrl })
      .where(eq(userTable.id, session.user.id));

    return json({ message: "success" });
  } catch (e) {
    if (e instanceof Response) return e;
    return apiError("INTERNAL_ERROR");
  }
}
