import { eq } from "drizzle-orm";
import { db } from "@/db";
import { doctorProfile, secretary } from "@/db/schema";
import { requireSession } from "@/lib/api-utils";
import { throwApiError } from "@/lib/errors";
import { getEffectivePlan } from "@/lib/plan-limits";

export type PracticeRole = "doctor" | "secretary";

export type PracticeAccess = {
	/** The practice being worked on */
	doctor: typeof doctorProfile.$inferSelect;
	role: PracticeRole;
	session: Awaited<ReturnType<typeof requireSession>>;
};

/**
 * The practice the signed-in user works in: their own (doctor) or the one
 * they're a secretary for. For routes secretaries may use — appointments,
 * patients, invoices, availability and the dashboard. Doctor-only routes
 * (medical files, recordings, AI chat, billing, profile) keep
 * `requireDoctorProfile`.
 *
 * Secretaries are refused while the doctor's plan doesn't include them or
 * the doctor isn't verified.
 */
export async function requirePractice(): Promise<PracticeAccess> {
	const session = await requireSession();

	const [own] = await db
		.select()
		.from(doctorProfile)
		.where(eq(doctorProfile.userId, session.user.id));
	if (own) return { doctor: own, role: "doctor", session };

	const [row] = await db
		.select({ doctor: doctorProfile })
		.from(secretary)
		.innerJoin(doctorProfile, eq(doctorProfile.id, secretary.doctorId))
		.where(eq(secretary.userId, session.user.id));
	if (!row) throwApiError("DOCTOR_PROFILE_NOT_FOUND");

	const { plan } = await getEffectivePlan(row.doctor.id);
	if (row.doctor.status !== "verified" || !plan.canHaveSecretaries) {
		throwApiError("SECRETARY_ACCESS_PAUSED");
	}
	return { doctor: row.doctor, role: "secretary", session };
}
