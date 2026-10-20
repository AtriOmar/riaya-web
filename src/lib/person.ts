import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
	type PersonPhoneRelationship,
	person,
	personPhone,
	personPhoneRelationships,
} from "@/db/schema";
import { apiError } from "@/lib/api-utils";
import {
	DEFAULT_PERSON_PREFERRED_LANGUAGE,
	isPersonPreferredLanguage,
	type PersonPreferredLanguage,
} from "@/lib/person-language";
import { DEFAULT_PHONE_COUNTRY, normalizePhoneForStorage } from "@/lib/phone";

export const personSources = ["call", "doctor"] as const;
export type PersonSource = (typeof personSources)[number];

/** The one format every `person_phone.phone_number` is stored in (E.164). */
export function toPersonPhone(raw: string | null | undefined): string | null {
	return normalizePhoneForStorage(raw, DEFAULT_PHONE_COUNTRY);
}

/** The person who owns this phone (`relationship = self`), if any. */
export async function findPhoneOwner(phone: string) {
	const phoneNumber = toPersonPhone(phone);
	if (!phoneNumber) return null;

	const link = await db.query.personPhone.findFirst({
		where: and(
			eq(personPhone.phoneNumber, phoneNumber),
			eq(personPhone.relationship, "self"),
		),
		with: { person: true },
	});
	return link?.person ?? null;
}

/** Everyone reachable on this phone: the owner and their family members. */
export async function findPersonsOnPhone(phone: string) {
	const phoneNumber = toPersonPhone(phone);
	if (!phoneNumber) return [];

	const links = await db.query.personPhone.findMany({
		where: eq(personPhone.phoneNumber, phoneNumber),
		with: { person: true },
	});
	return links.map((l) => ({ ...l.person, relationship: l.relationship }));
}

/** Saved person language, or the phone owner's. Defaults to Arabic. */
export async function resolvePreferredLanguage(input: {
	preferredLanguage?: string | null;
	phone?: string | null;
}): Promise<PersonPreferredLanguage> {
	if (isPersonPreferredLanguage(input.preferredLanguage)) {
		return input.preferredLanguage;
	}
	if (input.phone) {
		const owner = await findPhoneOwner(input.phone);
		if (isPersonPreferredLanguage(owner?.preferredLanguage)) {
			return owner.preferredLanguage;
		}
	}
	return DEFAULT_PERSON_PREFERRED_LANGUAGE;
}

/** Profile details we may know when someone is added or booked. */
type PersonProfile = {
	firstName: string;
	lastName?: string | null;
	dateOfBirth?: Date | null;
	gender?: string | null;
};

type PersonRow = typeof person.$inferSelect;

export const familyRelationships = personPhoneRelationships.filter(
	(r): r is Exclude<PersonPhoneRelationship, "self"> => r !== "self",
);
export type FamilyRelationship = (typeof familyRelationships)[number];

/** Fill only the profile fields that are still empty; never overwrite what is known. */
async function fillMissingProfile(row: PersonRow, profile: PersonProfile) {
	const patch: Partial<PersonRow> = {};
	if (!row.firstName) patch.firstName = profile.firstName;
	if (!row.lastName && profile.lastName) patch.lastName = profile.lastName;
	if (!row.dateOfBirth && profile.dateOfBirth)
		patch.dateOfBirth = profile.dateOfBirth;
	if (!row.gender && profile.gender) patch.gender = profile.gender;
	if (Object.keys(patch).length === 0) return row;

	const [updated] = await db
		.update(person)
		.set({ ...patch, updatedAt: new Date() })
		.where(eq(person.id, row.id))
		.returning();
	return updated ?? row;
}

/**
 * Add a family member under a phone (creating the owner if the phone is new).
 * Reuses a family member on that phone with the same first name.
 */
async function addFamilyMember(
	phoneNumber: string,
	profile: PersonProfile,
	relationship: FamilyRelationship,
	source: PersonSource,
) {
	await upsertPhoneOwner(phoneNumber, source);
	const onPhone = await findPersonsOnPhone(phoneNumber);
	const sameName = onPhone.find(
		(p) =>
			p.relationship !== "self" &&
			p.firstName?.toLowerCase() === profile.firstName.toLowerCase(),
	);
	if (sameName) return fillMissingProfile(sameName, profile);

	return db.transaction(async (tx) => {
		const [created] = await tx
			.insert(person)
			.values({
				source,
				firstName: profile.firstName,
				lastName: profile.lastName || null,
				dateOfBirth: profile.dateOfBirth ?? null,
				gender: profile.gender ?? null,
			})
			.returning();
		await tx
			.insert(personPhone)
			.values({ personId: created.id, phoneNumber, relationship });
		return created;
	});
}

/** Who a phone booking is for, as sent by the voice assistant. */
export const bookingPatientSchema = z.object({
	/** Someone already on this phone. Omit for the phone owner, or add a relationship for a new family member. */
	personId: z.number().int().positive().optional(),
	firstName: z.string().trim().min(1),
	lastName: z.string().trim().optional(),
	/** For a new family member: how they relate to the phone owner. */
	relationship: z.enum(familyRelationships).optional(),
});
export type BookingPatient = z.infer<typeof bookingPatientSchema>;

/**
 * The person a phone booking is for: someone already on this phone (must be
 * linked to it), a new family member under it, or by default the phone's owner.
 */
export async function resolveBookingPerson(
	phone: string,
	patient: BookingPatient,
) {
	const phoneNumber = toPersonPhone(phone);
	if (!phoneNumber) throw apiError("VALIDATION_ERROR");

	if (patient.personId != null) {
		await upsertPhoneOwner(phoneNumber, "call");
		const found = (await findPersonsOnPhone(phoneNumber)).find(
			(p) => p.id === patient.personId,
		);
		if (!found) throw apiError("PERSON_NOT_ON_PHONE");
		return fillMissingProfile(found, patient);
	}

	if (patient.relationship) {
		return addFamilyMember(phoneNumber, patient, patient.relationship, "call");
	}
	const owner = await upsertPhoneOwner(phoneNumber, "call");
	if (!owner) throw apiError("VALIDATION_ERROR");
	return fillMissingProfile(owner, patient);
}

/**
 * The person behind a patient a doctor adds: the phone's owner by default, or a
 * family member of the owner when the doctor says the number is someone else's.
 * Never reveals who owns the number.
 */
export async function resolveDoctorPatientPerson(
	phone: string,
	profile: PersonProfile,
	relationship?: FamilyRelationship,
) {
	const phoneNumber = toPersonPhone(phone);
	if (!phoneNumber) throw apiError("VALIDATION_ERROR");

	if (relationship) {
		return addFamilyMember(phoneNumber, profile, relationship, "doctor");
	}
	const owner = await upsertPhoneOwner(phoneNumber, "doctor");
	if (!owner) throw apiError("VALIDATION_ERROR");
	return fillMissingProfile(owner, profile);
}

/** Postgres unique violation. Drizzle wraps the driver error in `cause`. */
function isUniqueViolation(e: unknown): boolean {
	const err = e as { code?: string; cause?: { code?: string } };
	return err?.code === "23505" || err?.cause?.code === "23505";
}

/**
 * Return the phone's owner, creating the person and its `self` link when the
 * phone is new. `source` is set only on insert.
 */
export async function upsertPhoneOwner(phone: string, source: PersonSource) {
	const phoneNumber = toPersonPhone(phone);
	if (!phoneNumber) return null;

	const existing = await findPhoneOwner(phoneNumber);
	if (existing) return existing;

	try {
		return await db.transaction(async (tx) => {
			const [created] = await tx.insert(person).values({ source }).returning();
			await tx
				.insert(personPhone)
				.values({ personId: created.id, phoneNumber, relationship: "self" });
			return created;
		});
	} catch (e) {
		// Another request created the owner at the same time; use theirs.
		if (isUniqueViolation(e)) {
			return findPhoneOwner(phoneNumber);
		}
		throw e;
	}
}
