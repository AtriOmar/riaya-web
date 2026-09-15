import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { person } from "@/db/schema";
import {
	DEFAULT_PERSON_PREFERRED_LANGUAGE,
	isPersonPreferredLanguage,
	type PersonPreferredLanguage,
} from "@/lib/person-language";
import {
	DEFAULT_PHONE_COUNTRY,
	normalizePhoneForAiStorage,
	normalizePhoneForStorage,
	phoneStorageVariants,
} from "@/lib/phone";

export const personSources = ["call", "doctor"] as const;
export type PersonSource = (typeof personSources)[number];

async function findPersonByPhoneRaw(raw: string) {
	const normalized =
		normalizePhoneForAiStorage(raw) ??
		normalizePhoneForStorage(raw, DEFAULT_PHONE_COUNTRY);
	if (!normalized) return null;

	return db.query.person.findFirst({
		where: inArray(person.phoneNumber, phoneStorageVariants(normalized)),
	});
}

export async function findPersonByPhone(phoneNumber: string) {
	return findPersonByPhoneRaw(phoneNumber);
}

/** Saved person language, or lookup by phone. Defaults to Arabic. */
export async function resolvePreferredLanguage(input: {
	preferredLanguage?: string | null;
	phone?: string | null;
}): Promise<PersonPreferredLanguage> {
	if (isPersonPreferredLanguage(input.preferredLanguage)) {
		return input.preferredLanguage;
	}
	if (input.phone) {
		const row = await findPersonByPhone(input.phone);
		if (isPersonPreferredLanguage(row?.preferredLanguage)) {
			return row.preferredLanguage;
		}
	}
	return DEFAULT_PERSON_PREFERRED_LANGUAGE;
}

/** Upsert by phone. `source` is set only on insert; existing rows keep their source. */
export async function upsertPersonByPhone(
	phoneNumber: string,
	source: PersonSource,
) {
	const normalized =
		source === "call"
			? normalizePhoneForAiStorage(phoneNumber)
			: normalizePhoneForStorage(phoneNumber, DEFAULT_PHONE_COUNTRY);
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
