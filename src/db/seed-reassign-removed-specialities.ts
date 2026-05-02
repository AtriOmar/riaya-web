import "dotenv/config";
import { reassignRemovedSpecialitiesAndDeleteRows } from "./seeds/reassign-removed-specialities.seed";

async function main() {
	console.log(
		"Reassigning doctors/applications off removed specialities and deleting those rows...",
	);

	const result = await reassignRemovedSpecialitiesAndDeleteRows();
	console.log(
		`Done. Updated ${result.profilesUpdated} doctor profile(s), ${result.applicationsUpdated} application(s); removed ${result.specialitiesDeleted} speciality row(s) (by prior slug list).`,
	);
}

main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error("reassign-removed-specialities failed:", error);
		process.exit(1);
	});
