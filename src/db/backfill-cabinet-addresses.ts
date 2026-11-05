import "dotenv/config";
import { and, eq, isNotNull, isNull, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { doctorApplication, doctorProfile } from "@/db/schema";
import { getGeoProvider } from "@/lib/geo";

// Fills the empty `cabinet_address` of applications and profiles. An application
// first takes the address of the same user's profile; what is still empty and has
// coordinates is reverse geocoded from the pin. Rows with an address are not touched.

const PAUSE_MS = 250;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Table = typeof doctorProfile | typeof doctorApplication;

async function backfill(table: Table, name: string) {
	const provider = getGeoProvider();
	const rows = await db
		.select({
			id: table.id,
			lat: table.cabinetLatitude,
			lng: table.cabinetLongitude,
		})
		.from(table)
		.where(
			and(
				or(isNull(table.cabinetAddress), eq(table.cabinetAddress, "")),
				isNotNull(table.cabinetLatitude),
				isNotNull(table.cabinetLongitude),
			),
		);

	let filled = 0;
	let failed = 0;
	for (const row of rows) {
		if (row.lat == null || row.lng == null) continue;
		try {
			const place = await provider.reverse({ lat: row.lat, lng: row.lng });
			const address = place?.label.trim();
			if (!address) {
				failed++;
				continue;
			}
			await db
				.update(table)
				.set({ cabinetAddress: address })
				.where(eq(table.id, row.id));
			filled++;
		} catch (e) {
			failed++;
			console.error(`${name} ${row.id}:`, e instanceof Error ? e.message : e);
		}
		await sleep(PAUSE_MS);
	}
	console.log(
		`${name}: ${filled}/${rows.length} filled, ${failed} without result.`,
	);
}

/** Applications of verified doctors take the address their profile already has. */
async function copyFromProfiles() {
	const copied = await db
		.update(doctorApplication)
		.set({ cabinetAddress: doctorProfile.cabinetAddress })
		.from(doctorProfile)
		.where(
			and(
				eq(doctorProfile.userId, doctorApplication.userId),
				or(
					isNull(doctorApplication.cabinetAddress),
					eq(doctorApplication.cabinetAddress, ""),
				),
				isNotNull(doctorProfile.cabinetAddress),
				sql`${doctorProfile.cabinetAddress} <> ''`,
			),
		)
		.returning({ id: doctorApplication.id });
	console.log(`doctor_application: ${copied.length} copied from the profile.`);
}

async function main() {
	console.log(
		`Reverse geocoding cabinet addresses with ${getGeoProvider().name}...`,
	);
	await copyFromProfiles();
	await backfill(doctorProfile, "doctor_profile");
	await backfill(doctorApplication, "doctor_application");
}

main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error("Cabinet address backfill failed:", error);
		process.exit(1);
	});
