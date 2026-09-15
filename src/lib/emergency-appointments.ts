import { and, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { appointment } from "@/db/schema";
import { findBestFitDoctors, resolveSpeciality } from "@/lib/best-fit";

export const EMERGENCY_FANOUT_COUNT = 3;

/**
 * Cancel every other pending appointment in the same emergency group.
 * Used when one doctor accepts (first accept wins) or the patient cancels.
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
 * Fan-out urgent pending appointments to the top N ASAP best-fit doctors.
 * All rows share the same emergencyGroupId. First doctor to accept cancels
 * the rest via cancelEmergencySiblingAppointments.
 *
 * Plan AI booking limits are intentionally skipped — urgent cases must reach
 * nearby doctors even on Free plans that already hit their monthly cap.
 */
export async function bookEmergencyAppointments(params: {
	speciality: string;
	lat: number;
	long: number;
	name: string;
	phoneNumber: string;
	illness: string;
	limit?: number;
}) {
	const specialityData = await resolveSpeciality(params.speciality);
	if (!specialityData) return { specialityFound: false as const, created: [] };

	const now = new Date();
	const ranked = await findBestFitDoctors({
		specialityId: specialityData.id,
		lat: params.lat,
		long: params.long,
		desiredTime: now,
		currentTime: now,
	});

	const limit = params.limit ?? EMERGENCY_FANOUT_COUNT;
	const top = ranked.slice(0, limit);
	if (top.length === 0) {
		return { specialityFound: true as const, created: [], doctors: [] };
	}

	const emergencyGroupId = crypto.randomUUID();
	const created = await db
		.insert(appointment)
		.values(
			top.map((doc) => ({
				doctorId: doc.id,
				start: doc.nextSlot.start,
				end: doc.nextSlot.end,
				newPatientName: params.name,
				newPatientPhoneNumber: params.phoneNumber,
				status: "pending" as const,
				source: "ai" as const,
				name: "Urgent consultation",
				description: params.illness,
				urgent: true,
				emergencyGroupId,
			})),
		)
		.returning();

	return {
		specialityFound: true as const,
		emergencyGroupId,
		created,
		doctors: top.map((d) => ({
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
