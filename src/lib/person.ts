import { db } from "@/db";
import { person } from "@/db/schema";

export const personSources = ["call", "doctor"] as const;
export type PersonSource = (typeof personSources)[number];

/** Upsert by phone. `source` is set only on insert; existing rows keep their source. */
export async function upsertPersonByPhone(
	phoneNumber: string,
	source: PersonSource,
) {
	const trimmed = phoneNumber.trim();
	if (!trimmed) return null;

	const [row] = await db
		.insert(person)
		.values({ phoneNumber: trimmed, source })
		.onConflictDoUpdate({
			target: person.phoneNumber,
			set: { updatedAt: new Date() },
		})
		.returning();

	return row;
}
