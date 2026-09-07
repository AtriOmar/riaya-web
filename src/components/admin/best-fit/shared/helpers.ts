import moment from "moment";
import type { BestFitRangeDoctor } from "@/hooks/use-best-fit-range";
import { DEFAULT_MAX_HOUR, DEFAULT_MIN_HOUR } from "./constants";

/** Return the 7 calendar days of the week that contains `anchor`. */
export function getWeekDays(anchor: Date): Date[] {
	const start = moment(anchor).startOf("week");
	return Array.from({ length: 7 }, (_, i) =>
		start.clone().add(i, "days").toDate(),
	);
}

/** "yyyy-MM-dd" key from a Date. */
export function toDateKey(d: Date): string {
	const y = d.getFullYear();
	const mo = String(d.getMonth() + 1).padStart(2, "0");
	const dy = String(d.getDate()).padStart(2, "0");
	return `${y}-${mo}-${dy}`;
}

/** "HH:MM" key from a Date. */
export function toTimeKey(d: Date): string {
	return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** Format `minutes-from-midnight` as "HH:MM". */
export function fmtMinutes(minutes: number): string {
	const h = Math.floor(minutes / 60);
	const m = minutes % 60;
	return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Short display name: "Dr. Lastname" → "Dr. Firstname" → cabinetName → "#id". */
export function shortName(d: BestFitRangeDoctor): string {
	if (d.lastName) return `Dr. ${d.lastName}`;
	if (d.firstName) return `Dr. ${d.firstName}`;
	return d.cabinetName ?? `#${d.id}`;
}

export function formatFullDate(d: Date): string {
	return d.toLocaleDateString("en-GB", {
		weekday: "long",
		day: "2-digit",
		month: "long",
		year: "numeric",
	});
}

export function formatWeekLabel(weekDays: Date[]): string {
	const s = weekDays[0];
	const e = weekDays[6];
	if (!s || !e) return "";
	if (s.getMonth() === e.getMonth()) {
		return s.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
	}
	return `${s.toLocaleDateString("en-GB", { month: "short" })} – ${e.toLocaleDateString("en-GB", { month: "short", year: "numeric" })}`;
}

/** Build 30-minute time row starts from a min/max minute range. */
export function buildTimeRows(
	minMinutes: number | null,
	maxMinutes: number | null,
): number[] {
	const lo =
		Math.floor(Math.max(0, (minMinutes ?? DEFAULT_MIN_HOUR * 60) - 30) / 30) *
		30;
	const hi =
		Math.ceil(
			Math.min(24 * 60, (maxMinutes ?? DEFAULT_MAX_HOUR * 60) + 30) / 30,
		) * 30;
	const rows: number[] = [];
	for (let m = lo; m < hi; m += 30) rows.push(m);
	return rows;
}
