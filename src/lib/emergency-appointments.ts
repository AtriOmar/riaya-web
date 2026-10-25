import { and, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { appointment } from "@/db/schema";
import {
	type BestFitDoctorResult,
	findBestFitDoctors,
	resolveSpeciality,
} from "@/lib/best-fit";
import { scheduleEmergencyPendingTimeout } from "@/lib/pending-appointment-timeout";

/** Doctors who get an urgent request in each wave. */
export const EMERGENCY_FANOUT_COUNT = 3;
/** Waves sent before the patient is told that no doctor answered. */
export const EMERGENCY_MAX_WAVES = 3;
/** A doctor counts for an urgent request only if their first free slot starts this soon. */
export const EMERGENCY_SLOT_WINDOW_MS = 6 * 60 * 60 * 1000;

/**
 * Cancel every other pending appointment in the same emergency group.
 * Used when one doctor accepts (first accept wins), the patient cancels, or a
 * wave runs out of time.
 */
export async function cancelEmergencySiblingAppointments(params: {
	emergencyGroupId: string;
	exceptAppointmentId?: number;
}) {
	const conditions = [
		eq(appointment.emergencyGroupId, params.emergencyGroupId),
		eq(appointment.status, "pending"),
	];
	if (params.exceptAppointmentId != null) {
		conditions.push(ne(appointment.id, params.exceptAppointmentId));
	}

	const cancelled = await db
		.update(appointment)
		.set({ status: "cancelled", updatedAt: new Date() })
		.where(and(...conditions))
		.returning({
			id: appointment.id,
			doctorId: appointment.doctorId,
		});

	return cancelled;
}

/**
 * The best doctors for an urgent request: inside the search radius, with a
 * free slot within EMERGENCY_SLOT_WINDOW_MS, and not asked before in this group.
 * Doctors already asked are left out before ranking, so every wave picks from
 * doctors whose real drive time was checked.
 */
async function pickEmergencyDoctors(params: {
	specialityId: number;
	lat: number;
	long: number;
	excludeDoctorIds?: ReadonlySet<number>;
}): Promise<BestFitDoctorResult[]> {
	const now = new Date();
	const latestStart = now.getTime() + EMERGENCY_SLOT_WINDOW_MS;
	const ranked = await findBestFitDoctors({
		specialityId: params.specialityId,
		lat: params.lat,
		long: params.long,
		desiredTime: now,
		currentTime: now,
		excludeDoctorIds: params.excludeDoctorIds,
	});
	return ranked
		.filter(
			(d) => !d.outsideRadius && d.nextSlot.start.getTime() <= latestStart,
		)
		.slice(0, EMERGENCY_FANOUT_COUNT);
}

/** What the patient asked for; the same in every wave of a group. */
type EmergencyRequest = {
	lat: number;
	long: number;
	placeLabel: string | null;
	personId: number;
	contactPhone: string | null;
	illness: string | null;
};

/** Send one wave of urgent requests and start its timeout. */
async function sendEmergencyWave(params: {
	emergencyGroupId: string;
	wave: number;
	doctors: BestFitDoctorResult[];
	request: EmergencyRequest;
}) {
	const { request } = params;
	const created = await db
		.insert(appointment)
		.values(
			params.doctors.map((doc) => ({
				doctorId: doc.id,
				start: doc.nextSlot.start,
				end: doc.nextSlot.end,
				personId: request.personId,
				contactPhone: request.contactPhone,
				status: "pending" as const,
				source: "ai" as const,
				name: "Urgent consultation",
				description: request.illness,
				urgent: true,
				emergencyGroupId: params.emergencyGroupId,
				emergencyWave: params.wave,
				patientPlaceLabel: request.placeLabel,
				patientLatitude: request.lat,
				patientLongitude: request.long,
			})),
		)
		.returning();

	void scheduleEmergencyPendingTimeout({
		emergencyGroupId: params.emergencyGroupId,
		wave: params.wave,
	}).catch((err) =>
		console.error("[emergency-appointments] schedule wave timeout", err),
	);

	return created;
}

/**
 * Send the first wave of urgent pending requests to the best doctors who can
 * see the patient soon. All rows share one emergencyGroupId; the first doctor to
 * accept cancels the rest via cancelEmergencySiblingAppointments.
 */
export async function bookEmergencyAppointments(params: {
	speciality: string;
	lat: number;
	long: number;
	placeLabel: string | null;
	personId: number;
	contactPhone: string;
	illness: string;
}) {
	const specialityData = await resolveSpeciality(params.speciality);
	if (!specialityData) return { specialityFound: false as const, created: [] };

	const doctors = await pickEmergencyDoctors({
		specialityId: specialityData.id,
		lat: params.lat,
		long: params.long,
	});
	if (doctors.length === 0) {
		return { specialityFound: true as const, created: [], doctors: [] };
	}

	const emergencyGroupId = crypto.randomUUID();
	const created = await sendEmergencyWave({
		emergencyGroupId,
		wave: 1,
		doctors,
		request: params,
	});

	return {
		specialityFound: true as const,
		emergencyGroupId,
		created,
		doctors: doctors.map((d) => ({
			doctorId: d.id,
			name: `Dr. ${[d.firstName, d.lastName].filter(Boolean).join(" ")}`.trim(),
			cabinet: d.cabinetName,
			address: d.address,
			distanceKm: Math.round(d.distance * 10) / 10,
			slotStart: d.nextSlot.start.toISOString(),
			slotEnd: d.nextSlot.end.toISOString(),
		})),
	};
}

/**
 * A wave ran out of time (or every doctor in it refused): cancel what is still
 * pending and send the next wave to doctors not asked yet. `exhausted` means
 * there is no next wave, so the patient must be told nobody answered.
 * `wave` is the wave the timeout was scheduled for; an older one is ignored.
 */
export async function advanceEmergencyGroup(params: {
	emergencyGroupId: string;
	wave?: number;
}) {
	const rows = await db.query.appointment.findMany({
		where: eq(appointment.emergencyGroupId, params.emergencyGroupId),
		with: { person: true, doctor: true },
	});
	if (rows.length === 0) {
		return { status: "skipped" as const, reason: "not_found" };
	}
	if (rows.some((r) => r.status === "confirmed")) {
		return { status: "skipped" as const, reason: "already_accepted" };
	}
	const currentWave = Math.max(...rows.map((r) => r.emergencyWave ?? 1));
	if (params.wave != null && params.wave !== currentWave) {
		return { status: "skipped" as const, reason: "stale_wave" };
	}

	await cancelEmergencySiblingAppointments({
		emergencyGroupId: params.emergencyGroupId,
	});

	const sample = rows[0];
	const specialityId = rows.find((r) => r.doctor?.specialityId != null)?.doctor
		?.specialityId;
	if (
		currentWave < EMERGENCY_MAX_WAVES &&
		specialityId != null &&
		sample.personId != null &&
		sample.patientLatitude != null &&
		sample.patientLongitude != null
	) {
		const doctors = await pickEmergencyDoctors({
			specialityId,
			lat: sample.patientLatitude,
			long: sample.patientLongitude,
			excludeDoctorIds: new Set(
				rows.flatMap((r) => (r.doctorId != null ? [r.doctorId] : [])),
			),
		});
		if (doctors.length > 0) {
			const wave = currentWave + 1;
			const created = await sendEmergencyWave({
				emergencyGroupId: params.emergencyGroupId,
				wave,
				doctors,
				request: {
					lat: sample.patientLatitude,
					long: sample.patientLongitude,
					placeLabel: sample.patientPlaceLabel,
					personId: sample.personId,
					contactPhone: sample.contactPhone,
					illness: sample.description,
				},
			});
			return { status: "next_wave" as const, wave, created };
		}
	}

	return {
		status: "exhausted" as const,
		patientRow: sample,
		/** Every doctor asked in this group, so a callback does not suggest them again. */
		askedDoctorIds: rows.flatMap((r) =>
			r.doctorId != null ? [r.doctorId] : [],
		),
	};
}
