export type AvailabilitySlot = { start: number; end: number };
export type Availability = Record<number, AvailabilitySlot[]>;
function normalizeDayIndex(date: Date): number {
	const day = date.getDay();
	return day === 0 ? 6 : day - 1;
}
function roundToNearest30(minutes: number): number {
	return Math.ceil(minutes / 30) * 30;
}
function isSlotAvailable(
	slotStart: Date,
	slotEnd: Date,
	appointments: { start: Date | null; end: Date | null }[],
): boolean {
	return !appointments.some((appt) => {
		if (!appt.start || !appt.end) return false;
		const aStart = new Date(appt.start);
		const aEnd = new Date(appt.end);
		return (
			(slotStart > aStart && slotStart < aEnd) ||
			(slotEnd > aStart && slotEnd < aEnd) ||
			(slotStart <= aStart && slotEnd >= aEnd)
		);
	});
}
export function findNextAvailableSlot(
	availability: Availability,
	appointments: { start: Date | null; end: Date | null }[],
	currentTime: Date,
	desiredTime: Date,
): { start: Date; end: Date } | null {
	const dayOfWeek = normalizeDayIndex(desiredTime);
	const desiredMinutes = desiredTime.getHours() * 60 + desiredTime.getMinutes();
	let slotFromRight: { start: Date; end: Date } | null = null;
	let slotFromLeft: { start: Date; end: Date } | null = null;
	for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
		const dayIndex = (dayOfWeek + dayOffset) % 7;
		const slots = availability[dayIndex] || [];
		for (const slot of slots) {
			let start = Math.max(
				slot.start,
				dayOffset === 0 ? roundToNearest30(desiredMinutes) : slot.start,
			);
			while (start + 30 <= slot.end) {
				const slotStart = new Date(
					desiredTime.getTime() + dayOffset * 24 * 60 * 60 * 1000,
				);
				slotStart.setHours(Math.floor(start / 60), start % 60, 0, 0);
				const slotEnd = new Date(slotStart.getTime() + 30 * 60 * 1000);
				if (
					slotStart >= currentTime &&
					isSlotAvailable(slotStart, slotEnd, appointments)
				) {
					slotFromRight = { start: slotStart, end: slotEnd };
					dayOffset = 7;
					break;
				}
				start += 30;
			}
		}
	}
	for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
		const dayIndex = (dayOfWeek - dayOffset + 7) % 7;
		const slots = (availability[dayIndex] || []).slice().reverse();
		for (const slot of slots) {
			let start = Math.min(
				slot.end - 30,
				dayOffset === 0 ? roundToNearest30(desiredMinutes) - 30 : slot.end,
			);
			while (start >= slot.start) {
				const slotStart = new Date(
					desiredTime.getTime() - dayOffset * 24 * 60 * 60 * 1000,
				);
				slotStart.setHours(Math.floor(start / 60), start % 60, 0, 0);
				const slotEnd = new Date(slotStart.getTime() + 30 * 60 * 1000);
				if (
					slotStart >= currentTime &&
					isSlotAvailable(slotStart, slotEnd, appointments)
				) {
					slotFromLeft = { start: slotStart, end: slotEnd };
					dayOffset = 7;
					break;
				}
				start -= 30;
			}
		}
	}
	if (!slotFromLeft) return slotFromRight;
	if (!slotFromRight) return slotFromLeft;
	const contains = (slot: { start: Date; end: Date }) =>
		desiredTime >= slot.start && desiredTime < slot.end;
	const leftContains = contains(slotFromLeft);
	const rightContains = contains(slotFromRight);
	if (leftContains !== rightContains) {
		return leftContains ? slotFromLeft : slotFromRight;
	}
	const distance = (slot: { start: Date; end: Date }) =>
		Math.abs(slot.start.getTime() - desiredTime.getTime());
	return distance(slotFromLeft) <= distance(slotFromRight)
		? slotFromLeft
		: slotFromRight;
}
export function listAvailableSlotsForDoctor(
	availability: Availability,
	appointments: { start: Date | null; end: Date | null }[],
	currentTime: Date,
	anchorTime: Date,
	limit = 5,
): { start: Date; end: Date }[] {
	const results: { start: Date; end: Date }[] = [];
	const anchorDay = normalizeDayIndex(anchorTime);
	const anchorMinutes = anchorTime.getHours() * 60 + anchorTime.getMinutes();
	for (
		let dayOffset = 0;
		dayOffset < 7 && results.length < limit;
		dayOffset++
	) {
		const dayIndex = (anchorDay + dayOffset) % 7;
		const slots = availability[dayIndex] || [];
		for (const slot of slots) {
			let startMinutes = slot.start;
			if (dayOffset === 0) {
				startMinutes = Math.max(slot.start, roundToNearest30(anchorMinutes));
			}
			while (startMinutes + 30 <= slot.end && results.length < limit) {
				const start = new Date(
					anchorTime.getTime() + dayOffset * 24 * 60 * 60 * 1000,
				);
				start.setHours(Math.floor(startMinutes / 60), startMinutes % 60, 0, 0);
				const end = new Date(start.getTime() + 30 * 60 * 1000);
				if (
					start >= currentTime &&
					isSlotAvailable(start, end, appointments) &&
					start >= anchorTime
				) {
					results.push({ start, end });
				}
				startMinutes += 30;
			}
		}
	}
	return results;
}
