import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { person } from "@/db/schema";
import {
	DEFAULT_PHONE_COUNTRY,
	normalizePhoneForStorage,
	phoneStorageVariants,
} from "@/lib/phone";

export const personSources = ["call", "doctor"] as const;
export type PersonSource = (typeof personSources)[number];

async function findPersonByPhoneRaw(raw: string) {
	const normalized = normalizePhoneForStorage(raw, DEFAULT_PHONE_COUNTRY);
	if (!normalized) return null;

	return db.query.person.findFirst({
		where: inArray(person.phoneNumber, phoneStorageVariants(normalized)),
	});
}

/** Upsert by phone. `source` is set only on insert; existing rows keep their source. */
export async function upsertPersonByPhone(
	phoneNumber: string,
	source: PersonSource,
) {
	const normalized = normalizePhoneForStorage(
		phoneNumber,
		DEFAULT_PHONE_COUNTRY,
	);
	if (!normalized) return null;

	const existing = await findPersonByPhoneRaw(normalized);
	if (existing) {
		const [updated] = await db
			.update(person)
			.set({
				phoneNumber: normalized,
				updatedAt: new Date(),
			})
			.where(eq(person.id, existing.id))
			.returning();
		return updated ?? existing;
	}

	const [row] = await db
		.insert(person)
		.values({ phoneNumber: normalized, source })
		.onConflictDoUpdate({
			target: person.phoneNumber,
			set: { updatedAt: new Date() },
		})
		.returning();

	return row;
}
