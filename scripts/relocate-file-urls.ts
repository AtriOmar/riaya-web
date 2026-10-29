import { sql } from "drizzle-orm";
import { db } from "../src/db";

// One-off: the bucket is private now and every stored file URL points at the
// web app's /api/files route (CDN_URL). Rewrites the URLs saved before the
// change from the old public host to the new base.
//
//   OLD_CDN_URL=https://cdn.example.com pnpm tsx --env-file=.env scripts/relocate-file-urls.ts
//
// Safe to run twice: rows that already start with the new base are untouched.

const oldEnv = process.env.OLD_CDN_URL?.replace(/\/$/, "");
const newEnv = process.env.CDN_URL?.replace(/\/$/, "");
if (!oldEnv || !newEnv || oldEnv === newEnv) {
	console.error("Set OLD_CDN_URL and CDN_URL to two different values.");
	process.exit(1);
}
const oldBase: string = oldEnv;
const newBase: string = newEnv;

const columns: [table: string, column: string][] = [
	["doctor_profile", "cin_recto"],
	["doctor_profile", "cin_verso"],
	["doctor_profile", "medical_council_certificate"],
	["doctor_profile", "logo_url"],
	["doctor_profile", "stamp_url"],
	["doctor_application", "cin_recto"],
	["doctor_application", "cin_verso"],
	["doctor_application", "medical_council_certificate"],
	["consultation_recording", "audio_url"],
	["call", "recording_url"],
	["invoice", "pdf_url"],
	["user", "image"],
];

async function main() {
	for (const [table, column] of columns) {
		const result = await db.execute(
			sql.raw(
				`UPDATE "${table}" SET "${column}" = '${newBase}' || substr("${column}", ${oldBase.length + 1}) WHERE "${column}" LIKE '${oldBase}/%'`,
			),
		);
		console.log(`${table}.${column}: ${result.rowCount ?? 0} rows`);
	}
	const files = await db.execute(
		sql.raw(
			`UPDATE patient_medical_file SET documents = ARRAY(SELECT CASE WHEN d LIKE '${oldBase}/%' THEN '${newBase}' || substr(d, ${oldBase.length + 1}) ELSE d END FROM unnest(documents) AS d) WHERE EXISTS (SELECT 1 FROM unnest(documents) AS d WHERE d LIKE '${oldBase}/%')`,
		),
	);
	console.log(`patient_medical_file.documents: ${files.rowCount ?? 0} rows`);
	process.exit(0);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
