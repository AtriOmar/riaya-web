import "dotenv/config";
import { seedDoctorProfileAddresses } from "./seeds/doctor-profile-addresses.seed";

async function main() {
	console.log("Seeding doctor profile addresses from doctors list...");

	const result = await seedDoctorProfileAddresses();
	console.log(
		`Done. Updated ${result.doctorProfileRowsUpdated} profile row(s); ${result.entriesWithMatch} list entries matched at least one profile.`,
	);
}

main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error("Doctor profile address seed failed:", error);
		process.exit(1);
	});
