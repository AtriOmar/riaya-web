import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { db } from "@/db";
import { doctorProfile } from "@/db/schema";
import { auth } from "@/lib/auth";
import { apiError, throwApiError } from "@/lib/errors";

export type { ErrorCode } from "@/lib/errors";
// Re-export so routes only need to import from this one file
export { apiError, throwApiError } from "@/lib/errors";

export async function getSession() {
  const session = await auth.api.getSession({ headers: await headers() });
  return session;
}

export async function requireSession() {
  const session = await getSession();
  if (!session) throwApiError("UNAUTHORIZED");
  return session;
}

export async function requireAdmin() {
  const session = await requireSession();
  if (!session.user.accessId || session.user.accessId < 3)
    throwApiError("FORBIDDEN");
  return session;
}

export async function getDoctorProfile(userId: string) {
  const [profile] = await db
    .select()
    .from(doctorProfile)
    .where(eq(doctorProfile.userId, userId));
  return profile ?? null;
}

export async function requireDoctorProfile(userId: string) {
  const profile = await getDoctorProfile(userId);
  if (!profile) throwApiError("DOCTOR_PROFILE_NOT_FOUND");
  return profile;
}

export function json(data: unknown, status = 200) {
  return Response.json(data, { status });
}

export function validationError(issues: unknown) {
  return apiError("VALIDATION_ERROR", { issues });
}
