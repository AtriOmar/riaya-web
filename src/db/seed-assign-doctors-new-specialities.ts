import "dotenv/config";
import { assignRandomDoctorsToNewSpecialities } from "./seeds/assign-doctors-new-specialities.seed";

async function main() {
	console.log(
		"Ensuring new specialities exist and assigning a random subset of doctors...",
	);

	const result = await assignRandomDoctorsToNewSpecialities();
	console.log(
		`Done. Updated ${result.updated} doctor profile(s); target speciality ids: ${result.specialityIds.join(", ")}`,
	);
}

main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error("seed-assign-doctors-new-specialities failed:", error);
		process.exit(1);
	});
