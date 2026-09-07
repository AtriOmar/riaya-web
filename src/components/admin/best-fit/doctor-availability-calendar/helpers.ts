import type { AdminDoctorAppointment } from "@/hooks/use-admin-doctor";
import type { Availability } from "@/services/types";

/** JS `getDay()` is Sun=0; availability keys are Mon=0 … Sun=6. */
export function jsDayToAvailabilityKey(date: Date): number {
	const sun0 = date.getDay();
	return sun0 === 0 ? 6 : sun0 - 1;
}

export function buildAvailabilityByDay(avail: Availability | null | undefined) {
	const map: Record<number, { start: number; end: number }[]> = {};
	for (let day = 0; day < 7; day++) {
		const slots = avail?.[day as keyof Availability] ?? [];
		map[day] = slots.map((s) => ({ start: s.start, end: s.end }));
	}
	return map;
}

export function appointmentLabel(a: AdminDoctorAppointment): string {
	return a.name?.trim() || a.newPatientName?.trim() || "Appointment";
}

export function isAvailableAt(
	day: Date,
	minutes: number,
	availabilityByDay: Record<number, { start: number; end: number }[]>,
): boolean {
	const ranges = availabilityByDay[jsDayToAvailabilityKey(day)] ?? [];
	return ranges.some((s) => minutes >= s.start && minutes < s.end);
}

export function appointmentsStartingIn(
	day: Date,
	minutes: number,
	appointments: AdminDoctorAppointment[],
): AdminDoctorAppointment[] {
	const slotStart = new Date(day);
	slotStart.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
	const slotEnd = new Date(slotStart.getTime() + 30 * 60 * 1000);

	return appointments.filter((a) => {
		if (!a.start || !a.end || a.status === "cancelled") return false;
		const aStart = new Date(a.start);
		return aStart >= slotStart && aStart < slotEnd;
	});
}

export function isBusySlot(
	day: Date,
	minutes: number,
	appointments: AdminDoctorAppointment[],
): boolean {
	const slotStart = new Date(day);
	slotStart.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);

	return appointments.some((a) => {
		if (!a.start || !a.end || a.status === "cancelled") return false;
		const aStart = new Date(a.start);
		const aEnd = new Date(a.end);
		return aStart < slotStart && aEnd > slotStart;
	});
}
