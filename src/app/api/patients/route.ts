import { db } from "@/db";
import { patient } from "@/db/schema";
import {
  json,
  apiError,
  validationError,
  requireSession,
  requireDoctorProfile,
} from "@/lib/api-utils";
import { eq, and, or, ilike } from "drizzle-orm";
import { z } from "zod";
import type { NextRequest } from "next/server";

// ─── GET /api/patients ────────────────────────────────────────────────────────
// Returns patients for the authenticated doctor (with optional search)
// Admin can pass ?all=true to get all patients

const getSchema = z.object({
  search: z.string().optional(),
  all: z.coerce.boolean().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const session = await requireSession();
    const params = Object.fromEntries(req.nextUrl.searchParams);
    const parsed = getSchema.safeParse(params);

    if (!parsed.success) return validationError(parsed.error.issues);

    // Admin requests all patients
    if (
      parsed.data.all &&
      session.user.accessId &&
      session.user.accessId >= 3
    ) {
      const patients = await db.select().from(patient);
      return json(patients);
    }

    // Doctor's own patients
    const profile = await requireDoctorProfile(session.user.id);
    const search = parsed.data.search;

    let patients;
    if (search) {
      patients = await db
        .select({
          id: patient.id,
          firstName: patient.firstName,
          lastName: patient.lastName,
          cin: patient.cin,
          dateOfBirth: patient.dateOfBirth,
        })
        .from(patient)
        .where(
          and(
            eq(patient.doctorId, profile.id),
            or(
              ilike(patient.firstName, `%${search}%`),
              ilike(patient.lastName, `%${search}%`),
            ),
          ),
        );
    } else {
      patients = await db
        .select({
          id: patient.id,
          firstName: patient.firstName,
          lastName: patient.lastName,
          cin: patient.cin,
          dateOfBirth: patient.dateOfBirth,
        })
        .from(patient)
        .where(eq(patient.doctorId, profile.id));
    }

    return json(patients);
  } catch (e) {
    if (e instanceof Response) return e;
    return apiError("INTERNAL_ERROR");
  }
}

// ─── POST /api/patients ───────────────────────────────────────────────────────

const createSchema = z.object({
  cin: z.string().min(1),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  dateOfBirth: z.string().datetime(),
  gender: z.string().min(1),
  address: z.string().min(1),
  phoneNumber: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
    const profile = await requireDoctorProfile(session.user.id);
    const body = await req.json();
    const parsed = createSchema.safeParse(body);

    if (!parsed.success) return validationError(parsed.error.issues);

    const [created] = await db
      .insert(patient)
      .values({
        doctorId: profile.id,
        cin: parsed.data.cin,
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        dateOfBirth: new Date(parsed.data.dateOfBirth),
        gender: parsed.data.gender,
        address: parsed.data.address,
        phoneNumber: parsed.data.phoneNumber,
      })
      .returning();

    return json(created, 201);
  } catch (e) {
    if (e instanceof Response) return e;
    return apiError("INTERNAL_ERROR");
  }
}
