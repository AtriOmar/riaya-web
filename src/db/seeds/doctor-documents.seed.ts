import { eq, sql } from "drizzle-orm";
import { db } from "../index";
import { doctorApplication, doctorProfile } from "../schema";

// Shared sample files served from web/public.
const CIN_RECTO = "/cin_recto_placeholder.jpg";
const CIN_VERSO = "/cin_verso_placeholder.jpg";
const CERTIFICATE = "/medical_council_certificate_placeholder.svg";

/**
 * Fill missing doctor documents on test data: CIN images, council certificate
 * and a random council number. Existing values are never overwritten. The
 * doctor's application row is then synced from the profile.
 */
export async function seedDoctorDocuments() {
	const profiles = await db
		.update(doctorProfile)
		.set({
			cinRecto: sql`coalesce(${doctorProfile.cinRecto}, ${CIN_RECTO})`,
			cinVerso: sql`coalesce(${doctorProfile.cinVerso}, ${CIN_VERSO})`,
			medicalCouncilCertificate: sql`coalesce(${doctorProfile.medicalCouncilCertificate}, ${CERTIFICATE})`,
			medicalCouncilNumber: sql`coalesce(${doctorProfile.medicalCouncilNumber}, 'CNOM-' || lpad(floor(random() * 100000)::int::text, 5, '0'))`,
			updatedAt: new Date(),
		})
		.where(
			sql`${doctorProfile.cinRecto} is null or ${doctorProfile.cinVerso} is null or ${doctorProfile.medicalCouncilCertificate} is null or ${doctorProfile.medicalCouncilNumber} is null`,
		)
		.returning({ id: doctorProfile.id });

	const applications = await db
		.update(doctorApplication)
		.set({
			cinRecto: sql`coalesce(${doctorApplication.cinRecto}, ${doctorProfile.cinRecto})`,
			cinVerso: sql`coalesce(${doctorApplication.cinVerso}, ${doctorProfile.cinVerso})`,
			medicalCouncilCertificate: sql`coalesce(${doctorApplication.medicalCouncilCertificate}, ${doctorProfile.medicalCouncilCertificate})`,
			medicalCouncilNumber: sql`coalesce(${doctorApplication.medicalCouncilNumber}, ${doctorProfile.medicalCouncilNumber})`,
			updatedAt: new Date(),
		})
		.from(doctorProfile)
		.where(eq(doctorApplication.userId, doctorProfile.userId))
		.returning({ id: doctorApplication.id });

	return {
		profilesUpdated: profiles.length,
		applicationsUpdated: applications.length,
	};
}
