import "dotenv/config";
import { randomizeDoctorLocations } from "./seeds/randomize-doctor-locations.seed";

async function main() {
	console.log("Assigning unique random cabinet locations inside each city...");

	const result = await randomizeDoctorLocations();
	console.log(
		`Done. Profiles: ${result.updatedProfiles}/${result.totalProfiles} updated, applications: ${result.updatedApplications} updated, skipped: ${result.skipped}.`,
	);
}

main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error("Randomizing doctor locations failed:", error);
		process.exit(1);
	});
