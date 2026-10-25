import { eq } from "drizzle-orm";
import { db } from "@/db";
import { type appointment, doctorProfile, person } from "@/db/schema";
import { findBestFitDoctors } from "@/lib/best-fit";
import { DEFAULT_PHONE_COUNTRY, normalizePhoneForStorage } from "@/lib/phone";
import { connection } from "@/lib/queue";

/**
 * When a doctor refuses an AI request we remember what the patient asked for
 * (speciality, the patient's area, time, who it was for and why, doctors who
 * already said no). The refusal message and the next phone call both use it to
 * suggest other doctors with fresh slots and rebook without asking again.
 * Stored in Redis with a short TTL, so no schema change is needed.
 */

const REFUSAL_CONTEXT_TTL_SECONDS = 24 * 60 * 60;
export const MAX_REFUSAL_SUGGESTIONS = 3;

type StoredRefusal = {
	specialityId: number;
	/** Where to search: the patient's place, else the refusing doctor's cabinet. */
	lat: number;
	long: number;
	desiredTime: string;
	refusedDoctorIds: number[];
	lastRefusedDoctorName: string;
	/** Who the refused request was for, and why. Missing on contexts stored before. */
	personId?: number | null;
	illness?: string | null;
};

/** The refused request, as the appointment row holds it. */
type RefusedAppointment = Pick<
	typeof appointment.$inferSelect,
	| "contactPhone"
	| "doctorId"
	| "start"
	| "patientLatitude"
	| "patientLongitude"
	| "personId"
	| "description"
>;

export type RefusalSuggestion = {
	doctorId: number;
	name: string;
	cabinetName: string | null;
	address: string | null;
	distanceKm: number;
	slotStart: string;
	slotEnd: string;
};

export type RefusalContext = {
	refusedDoctorName: string;
	suggestions: RefusalSuggestion[];
	/** Who the refused request was for (someone on the calling phone). */
	patient: {
		personId: number;
		firstName: string | null;
		lastName: string | null;
	} | null;
	/** The reason for the visit given in the refused request. */
	illness: string | null;
};

function keyForPhone(phone: string): string | null {
	const normalized = normalizePhoneForStorage(phone, DEFAULT_PHONE_COUNTRY);
	return normalized ? `refusal-context:${normalized}` : null;
}

function doctorFullName(
	firstName: string | null,
	lastName: string | null,
): string {
	return [firstName, lastName]
		.filter((p) => p?.trim())
		.join(" ")
		.trim();
}

async function readStored(key: string): Promise<StoredRefusal | null> {
	const raw = await connection.get(key);
	if (!raw) return null;
	try {
		return JSON.parse(raw) as StoredRefusal;
	} catch {
		return null;
	}
}

/** Remember a refused request for the phone that booked it. Never throws. */
export async function recordRefusal(
	refused: RefusedAppointment,
): Promise<void> {
	try {
		const key = refused.contactPhone ? keyForPhone(refused.contactPhone) : null;
		if (!key || refused.doctorId == null) return;

		const doctor = await db.query.doctorProfile.findFirst({
			where: eq(doctorProfile.id, refused.doctorId),
		});
		if (!doctor || doctor.specialityId == null) return;

		// Search around the patient, not the doctor who refused; the cabinet is
		// only a fallback for bookings made before the patient's place was kept.
		const place =
			refused.patientLatitude != null && refused.patientLongitude != null
				? { lat: refused.patientLatitude, long: refused.patientLongitude }
				: doctor.cabinetLatitude != null && doctor.cabinetLongitude != null
					? { lat: doctor.cabinetLatitude, long: doctor.cabinetLongitude }
					: null;
		if (!place) return;

		const previous = await readStored(key);
		const refusedDoctorIds = new Set(previous?.refusedDoctorIds ?? []);
		refusedDoctorIds.add(doctor.id);

		const stored: StoredRefusal = {
			specialityId: doctor.specialityId,
			lat: place.lat,
			long: place.long,
			desiredTime: (refused.start ?? new Date()).toISOString(),
			refusedDoctorIds: [...refusedDoctorIds],
			lastRefusedDoctorName: doctorFullName(doctor.firstName, doctor.lastName),
			personId: refused.personId,
			illness: refused.description,
		};
		await connection.set(
			key,
			JSON.stringify(stored),
			"EX",
			REFUSAL_CONTEXT_TTL_SECONDS,
		);
	} catch (err) {
		console.error("[refusal-suggestions] record failed", err);
	}
}

/** Fresh suggestions (excluding doctors who refused) for a patient phone, or null. */
export async function getRefusalContext(
	patientPhone: string,
): Promise<RefusalContext | null> {
	try {
		const key = keyForPhone(patientPhone);
		if (!key) return null;
		const stored = await readStored(key);
		if (!stored) return null;

		const now = new Date();
		const stillFuture = new Date(stored.desiredTime) > now;
		const ranked = await findBestFitDoctors({
			specialityId: stored.specialityId,
			lat: stored.lat,
			long: stored.long,
			desiredTime: stillFuture ? new Date(stored.desiredTime) : now,
			currentTime: now,
		});

		const suggestions = ranked
			.filter((d) => !stored.refusedDoctorIds.includes(d.id))
			.slice(0, MAX_REFUSAL_SUGGESTIONS)
			.map((d) => ({
				doctorId: d.id,
				name: doctorFullName(d.firstName, d.lastName),
				cabinetName: d.cabinetName,
				address: d.address,
				distanceKm: Math.round(d.distance * 10) / 10,
				slotStart: d.nextSlot.start.toISOString(),
				slotEnd: d.nextSlot.end.toISOString(),
			}));

		const patient =
			stored.personId != null
				? ((await db.query.person.findFirst({
						where: eq(person.id, stored.personId),
						columns: { id: true, firstName: true, lastName: true },
					})) ?? null)
				: null;

		return {
			refusedDoctorName: stored.lastRefusedDoctorName,
			suggestions,
			patient: patient
				? {
						personId: patient.id,
						firstName: patient.firstName,
						lastName: patient.lastName,
					}
				: null,
			illness: stored.illness ?? null,
		};
	} catch (err) {
		console.error("[refusal-suggestions] read failed", err);
		return null;
	}
}

/** Drop the context once the patient booked someone else. Never throws. */
export async function clearRefusalContext(patientPhone: string): Promise<void> {
	try {
		const key = keyForPhone(patientPhone);
		if (key) await connection.del(key);
	} catch {
		/* best effort */
	}
}
