import "dotenv/config";
import { seedDoctorProfileCins } from "./seeds/doctor-profile-cins.seed";

async function main() {
	console.log("Seeding doctor profile CINs from doctors list...");

	const result = await seedDoctorProfileCins();
	console.log(
		`Done. Updated ${result.doctorProfileRowsUpdated} profile row(s); ${result.entriesWithMatch} list entries matched at least one profile.`,
	);
}

main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error("Doctor profile CIN seed failed:", error);
		process.exit(1);
	});
