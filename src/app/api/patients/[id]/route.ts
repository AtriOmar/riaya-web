import { db } from "@/db";
import { patient } from "@/db/schema";
import { json, apiError, requireSession, requireDoctorProfile } from "@/lib/api-utils";
import { eq, and } from "drizzle-orm";
import type { NextRequest } from "next/server";

// ─── GET /api/patients/[id] ──────────────────────────────────────────────────

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    const profile = await requireDoctorProfile(session.user.id);

    const { id } = await params;
    const patientId = Number(id);
    if (Number.isNaN(patientId)) return apiError("INVALID_ID");

    const record = await db.query.patient.findFirst({
      where: and(eq(patient.id, patientId), eq(patient.doctorId, profile.id)),
      with: { medicalFiles: true },
    });

    if (!record) return apiError("PATIENT_NOT_FOUND");

    return json(record);
  } catch (e) {
    if (e instanceof Response) return e;
    return apiError("INTERNAL_ERROR");
  }
}
