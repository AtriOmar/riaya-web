import { and, eq, sql } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { db } from "@/db";
import {
	consultationRecording,
	doctorApplication,
	doctorProfile,
	invoice,
	patient,
	patientMedicalFile,
} from "@/db/schema";
import { apiError, getDoctorProfile, requireSession } from "@/lib/api-utils";
import { requirePractice } from "@/lib/practice";
import { signedDownloadUrl } from "@/lib/r2";

// ─── GET /api/files/<key> ────────────────────────────────────────────────────
// The bucket is private. Every stored file URL points here: the route checks
// that the signed-in user may read that file, then redirects to a signed link
// that works for one minute. Anyone else gets the same 404 as for a file that
// does not exist.

const notFound = () => new Response(null, { status: 404 });

const KEY_PATTERN = /^[a-z-]+(\/[a-z-]+)*\/[A-Za-z0-9_.-]+$/;

function isAdmin(session: { user: { accessId?: number | null } }) {
	return !!session.user.accessId && session.user.accessId >= 3;
}

/** Whether the signed-in user may read the file stored under `key`. */
async function canRead(key: string, storedUrl: string): Promise<boolean> {
	const session = await requireSession();
	const folder = key.split("/")[0];

	switch (folder) {
		case "profile-pictures":
			return true;

		case "test-call-recordings":
		case "calls":
			return isAdmin(session);

		case "doctor-applications": {
			// The doctor's own identity documents, or the administrator reviewing them.
			if (isAdmin(session)) return true;
			const [application] = await db
				.select({ id: doctorApplication.id })
				.from(doctorApplication)
				.where(
					and(
						eq(doctorApplication.userId, session.user.id),
						sql`${storedUrl} in (${doctorApplication.cinRecto}, ${doctorApplication.cinVerso}, ${doctorApplication.medicalCouncilCertificate})`,
					),
				);
			if (application) return true;
			const [profile] = await db
				.select({ id: doctorProfile.id })
				.from(doctorProfile)
				.where(
					and(
						eq(doctorProfile.userId, session.user.id),
						sql`${storedUrl} in (${doctorProfile.cinRecto}, ${doctorProfile.cinVerso}, ${doctorProfile.medicalCouncilCertificate})`,
					),
				);
			return !!profile;
		}

		case "practice-branding": {
			// Printed on invoices: the practice's doctor and secretaries.
			if (isAdmin(session)) return true;
			const { doctor } = await requirePractice();
			const [row] = await db
				.select({ id: doctorProfile.id })
				.from(doctorProfile)
				.where(
					and(
						eq(doctorProfile.id, doctor.id),
						sql`${storedUrl} in (${doctorProfile.logoUrl}, ${doctorProfile.stampUrl})`,
					),
				);
			return !!row;
		}

		case "invoices": {
			const { doctor } = await requirePractice();
			const [row] = await db
				.select({ id: invoice.id })
				.from(invoice)
				.where(
					and(eq(invoice.doctorId, doctor.id), eq(invoice.pdfUrl, storedUrl)),
				);
			return !!row;
		}

		case "medical-files": {
			// Doctor only: secretaries never read medical files.
			const profile = await getDoctorProfile(session.user.id);
			if (!profile) return false;
			const [row] = await db
				.select({ id: patientMedicalFile.id })
				.from(patientMedicalFile)
				.innerJoin(patient, eq(patient.id, patientMedicalFile.patientId))
				.where(
					and(
						eq(patient.doctorId, profile.id),
						sql`${storedUrl} = any(${patientMedicalFile.documents})`,
					),
				);
			return !!row;
		}

		case "recordings": {
			const profile = await getDoctorProfile(session.user.id);
			if (!profile) return false;
			const [row] = await db
				.select({ id: consultationRecording.id })
				.from(consultationRecording)
				.where(
					and(
						eq(consultationRecording.doctorId, profile.id),
						eq(consultationRecording.audioUrl, storedUrl),
					),
				);
			return !!row;
		}

		default:
			return false;
	}
}

export async function GET(
	_req: NextRequest,
	{ params }: { params: Promise<{ key: string[] }> },
) {
	try {
		const { key: segments } = await params;
		const key = segments.map(decodeURIComponent).join("/");
		if (!KEY_PATTERN.test(key) || key.includes("..")) {
			return notFound();
		}

		const base = (process.env.CDN_URL ?? "").replace(/\/$/, "");
		if (!(await canRead(key, `${base}/${key}`))) return notFound();

		return new Response(null, {
			status: 302,
			headers: {
				Location: await signedDownloadUrl(key, 60),
				"Cache-Control": "private, no-store",
			},
		});
	} catch (e) {
		if (e instanceof Response) return e;
		return apiError("INTERNAL_ERROR");
	}
}
