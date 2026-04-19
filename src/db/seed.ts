import "dotenv/config";
import { seedCities } from "./seeds/cities.seed";
import { seedDoctors } from "./seeds/doctors.seed";
import { seedSpecialities } from "./seeds/specialities.seed";

async function main() {
	console.log("Starting database seed...");

	const cityRefs = await seedCities();
	console.log(`Seeded cities. Available city refs: ${cityRefs.length}`);

	const specialityRefs = await seedSpecialities();
	console.log(
		`Seeded specialities. Available speciality refs: ${specialityRefs.length}`,
	);

	const doctorResult = await seedDoctors();
	console.log(
		`Seeded doctors. Prepared users: ${doctorResult.insertedUsers}, profiles: ${doctorResult.insertedProfiles}, applications: ${doctorResult.insertedApplications}, skipped (missing city/speciality): ${doctorResult.skippedDoctors}`,
	);

	console.log("Database seed completed.");
}

main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error("Database seed failed:", error);
		process.exit(1);
	});
