import type { TimelineEntry } from "@/hooks/use-realtime-socket";

// What the AI has learned so far on a call, read back from its tool calls.
// Live entries carry args/result as JSON strings, saved ones as objects; both
// are accepted. Only successful calls count, and a later call wins.

export type JourneyPlace = { lat: number; lng: number; label: string | null };

export type JourneyDoctor = {
	id: number;
	name: string;
	/** Position in the slot search results (1 = best fit); null for a doctor asked for by name. */
	rank: number | null;
	distanceKm: number | null;
	/** Spoken label of the slot offered, e.g. "tomorrow at 10:00". */
	when: string | null;
	/** Beyond the search radius, offered only because nobody closer was free. */
	farAway: boolean;
};

export type CallJourney = {
	/** Places the latest location search returned. */
	candidates: JourneyPlace[];
	/** Where the patient is: the place the doctor search ran from. */
	patient: JourneyPlace | null;
	specialitySlug: string | null;
	/** Doctors offered to the patient, in the order they were offered. */
	offered: JourneyDoctor[];
	booking: { doctorIds: number[]; urgent: boolean } | null;
};

type Obj = Record<string, unknown>;

function asObject(value: unknown): Obj | null {
	if (typeof value === "string") {
		try {
			return asObject(JSON.parse(value));
		} catch {
			return null;
		}
	}
	return value !== null && typeof value === "object" && !Array.isArray(value)
		? (value as Obj)
		: null;
}

const num = (v: unknown) =>
	typeof v === "number" && Number.isFinite(v)
		? v
		: typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))
			? Number(v)
			: null;

const str = (v: unknown) =>
	typeof v === "string" && v.trim() !== "" ? v.trim() : null;

const objects = (v: unknown) =>
	Array.isArray(v) ? v.map(asObject).filter((o): o is Obj => o !== null) : [];

/** Same rounding the voice service uses to match places by coordinates. */
const placeKey = (lat: number, lng: number) =>
	`${lat.toFixed(4)},${lng.toFixed(4)}`;

function toPlace(o: Obj | null, label: string | null): JourneyPlace | null {
	const lat = num(o?.latitude);
	const lng = num(o?.longitude);
	return lat != null && lng != null ? { lat, lng, label } : null;
}

function toDoctor(o: Obj, rank: number | null): JourneyDoctor | null {
	const id = num(o.doctorId);
	if (id == null) return null;
	return {
		id,
		name: str(o.name) ?? `Doctor #${id}`,
		rank,
		distanceKm: num(o.distanceKm),
		when: str(o.when),
		farAway: o.farAway === true,
	};
}

export function getCallJourney(timeline: TimelineEntry[]): CallJourney {
	const labels = new Map<string, string>();
	let candidates: JourneyPlace[] = [];
	let searchedFrom: { lat: number; lng: number } | null = null;
	let specialitySlug: string | null = null;
	const offered = new Map<number, JourneyDoctor>();
	let ranked = 0;
	/** Specialities of doctors found by name, for a call that never searched by speciality. */
	const namedSpeciality = new Map<number, string>();
	let namedDoctorId: number | null = null;
	let booking: CallJourney["booking"] = null;

	for (const entry of timeline) {
		if (entry.kind !== "function_call" || entry.status !== "success") continue;
		const args = asObject(entry.args);
		const result = asObject(entry.result);
		if (!result) continue;

		switch (entry.name) {
			case "search_location": {
				if (result.cityOnly === true) {
					const city = asObject(result.city);
					const place = toPlace(city, str(city?.fr_name) ?? str(city?.en_name));
					candidates = place ? [place] : [];
					break;
				}
				candidates = objects(result.results).flatMap((r) => {
					const place = toPlace(r, str(r.name));
					return place ? [place] : [];
				});
				for (const p of candidates) {
					if (p.label) labels.set(placeKey(p.lat, p.lng), p.label);
				}
				break;
			}
			case "find_available_slots":
			case "book_emergency_appointments": {
				const from = toPlace(args, null);
				if (from) searchedFrom = from;
				specialitySlug = str(args?.speciality_slug) ?? specialitySlug;
				if (entry.name === "book_emergency_appointments") {
					if (result.success !== true) break;
					const doctors = objects(result.doctors).flatMap((d) => {
						const doctor = toDoctor(d, null);
						return doctor ? [doctor] : [];
					});
					for (const d of doctors) if (!offered.has(d.id)) offered.set(d.id, d);
					booking = { doctorIds: doctors.map((d) => d.id), urgent: true };
					break;
				}
				// A follow-up search excludes doctors already offered, so ranks continue.
				for (const d of objects(result.doctors)) {
					const doctor = toDoctor(d, ranked + 1);
					if (!doctor || offered.has(doctor.id)) continue;
					ranked++;
					offered.set(doctor.id, doctor);
				}
				break;
			}
			case "find_doctor_by_name": {
				for (const d of objects(result.doctors)) {
					const id = num(d.doctorId);
					const slug = str(d.specialitySlug);
					if (id != null && slug) namedSpeciality.set(id, slug);
				}
				break;
			}
			case "find_doctor_slots": {
				const d = asObject(result.doctor);
				const doctor = d && toDoctor(d, null);
				if (!doctor) break;
				const firstSlot = objects(result.slots)[0];
				namedDoctorId = doctor.id;
				if (!offered.has(doctor.id)) {
					offered.set(doctor.id, {
						...doctor,
						when: str(firstSlot?.when),
					});
				}
				break;
			}
			case "book_appointment": {
				const id = num(args?.doctor_id);
				if (result.success === true && id != null) {
					booking = { doctorIds: [id], urgent: false };
					namedDoctorId ??= id;
				}
				break;
			}
		}
	}

	const patient = searchedFrom
		? {
				...searchedFrom,
				label: labels.get(placeKey(searchedFrom.lat, searchedFrom.lng)) ?? null,
			}
		: // One match is taken as the place without asking the patient.
			candidates.length === 1
			? (candidates[0] ?? null)
			: null;

	if (!specialitySlug && namedDoctorId != null) {
		specialitySlug = namedSpeciality.get(namedDoctorId) ?? null;
	}

	return {
		candidates,
		patient,
		specialitySlug,
		offered: [...offered.values()],
		booking,
	};
}
