import { and, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { patient, patientMedicalFile } from "@/db/schema";
import {
  apiError,
  json,
  requireDoctorProfile,
  requireSession,
  validationError,
} from "@/lib/api-utils";

// ─── POST /api/patients/[id]/medical-files ───────────────────────────────────
// Creates a medical file for a patient. Documents are now URLs (uploaded via R2 signed URLs).

const createSchema = z.object({
  type: z.string().min(1),
  date: z.string().datetime(),
  title: z.string().min(1),
  description: z.string().min(1),
  documents: z.array(z.url()).optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireSession();
    const profile = await requireDoctorProfile(session.user.id);

    const { id } = await params;
    const patientId = Number(id);
    if (Number.isNaN(patientId)) return apiError("INVALID_ID");

    // Verify patient belongs to this doctor
    const [found] = await db
      .select({ id: patient.id })
      .from(patient)
      .where(and(eq(patient.id, patientId), eq(patient.doctorId, profile.id)));

    if (!found) return apiError("PATIENT_NOT_FOUND");

    const body = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error.issues);

    const [medicalFile] = await db
      .insert(patientMedicalFile)
      .values({
        patientId: found.id,
        type: parsed.data.type,
        date: new Date(parsed.data.date),
        title: parsed.data.title,
        description: parsed.data.description,
        documents: parsed.data.documents ?? [],
      })
      .returning();

    return json(medicalFile, 201);
  } catch (e) {
    if (e instanceof Response) return e;
    return apiError("INTERNAL_ERROR");
  }
}

// ─── PUT /api/patients/[id]/medical-files ────────────────────────────────────

const updateSchema = z.object({
  medicalFileId: z.coerce.number().int().positive(),
  title: z.string().optional(),
  description: z.string().optional(),
});

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireSession();
    const profile = await requireDoctorProfile(session.user.id);

    const { id } = await params;
    const patientId = Number(id);
    if (Number.isNaN(patientId)) return apiError("INVALID_ID");

    // Verify patient belongs to this doctor
    const [found] = await db
      .select({ id: patient.id })
      .from(patient)
      .where(and(eq(patient.id, patientId), eq(patient.doctorId, profile.id)));

    if (!found) return apiError("PATIENT_NOT_FOUND");

    const body = await req.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error.issues);

    const { medicalFileId, ...fields } = parsed.data;
    const updateData: Record<string, unknown> = {};
    if (fields.title !== undefined) updateData.title = fields.title;
    if (fields.description !== undefined)
      updateData.description = fields.description;

    const [updated] = await db
      .update(patientMedicalFile)
      .set(updateData)
      .where(
        and(
          eq(patientMedicalFile.id, medicalFileId),
          eq(patientMedicalFile.patientId, patientId),
        ),
      )
      .returning();

    if (!updated) return apiError("MEDICAL_FILE_NOT_FOUND");

    return json(updated);
  } catch (e) {
    if (e instanceof Response) return e;
    return apiError("INTERNAL_ERROR");
  }
}

// ─── DELETE /api/patients/[id]/medical-files ─────────────────────────────────

const deleteSchema = z.object({
  medicalFileId: z.coerce.number().int().positive(),
});

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireSession();
    const profile = await requireDoctorProfile(session.user.id);

    const { id } = await params;
    const patientId = Number(id);
    if (Number.isNaN(patientId)) return apiError("INVALID_ID");

    // Verify patient belongs to this doctor
    const [found] = await db
      .select({ id: patient.id })
      .from(patient)
      .where(and(eq(patient.id, patientId), eq(patient.doctorId, profile.id)));

    if (!found) return apiError("PATIENT_NOT_FOUND");

    const searchParams = Object.fromEntries(req.nextUrl.searchParams);
    const parsed = deleteSchema.safeParse(searchParams);
    if (!parsed.success) return validationError(parsed.error.issues);

    const [deleted] = await db
      .delete(patientMedicalFile)
      .where(
        and(
          eq(patientMedicalFile.id, parsed.data.medicalFileId),
          eq(patientMedicalFile.patientId, patientId),
        ),
      )
      .returning();

    if (!deleted) return apiError("MEDICAL_FILE_NOT_FOUND");

    return json({ message: "Medical file deleted successfully" });
  } catch (e) {
    if (e instanceof Response) return e;
    return apiError("INTERNAL_ERROR");
  }
}
