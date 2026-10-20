import "dotenv/config";
import { seedDoctorDocuments } from "./seeds/doctor-documents.seed";

async function main() {
	console.log("Filling missing doctor documents with sample files...");

	const result = await seedDoctorDocuments();
	console.log(
		`Done. Updated ${result.profilesUpdated} profile(s) and ${result.applicationsUpdated} application(s).`,
	);
}

main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error("Doctor documents seed failed:", error);
		process.exit(1);
	});
