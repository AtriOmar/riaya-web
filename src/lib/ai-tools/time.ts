// Dates the assistant reads and writes are Tunisia wall-clock times, whatever
// timezone the server runs in.

export const PRACTICE_TIME_ZONE = "Africa/Tunis";

/** Minutes the time zone is ahead of UTC at `date`. */
function offsetMinutes(date: Date): number {
	const parts = new Intl.DateTimeFormat("en-US", {
		timeZone: PRACTICE_TIME_ZONE,
		hourCycle: "h23",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
	}).formatToParts(date);
	const get = (type: string) =>
		Number(parts.find((p) => p.type === type)?.value);
	const asUtc = Date.UTC(
		get("year"),
		get("month") - 1,
		get("day"),
		get("hour"),
		get("minute"),
		get("second"),
	);
	return Math.round((asUtc - date.getTime()) / 60_000);
}

/** `YYYY-MM-DDTHH:mm` (or `YYYY-MM-DD`, midnight) in Tunis time → the instant. */
export function fromPracticeTime(local: string): Date {
	const [datePart, timePart = "00:00"] = local.split("T");
	const [y, m, d] = datePart.split("-").map(Number);
	const [hh, mm] = timePart.split(":").map(Number);
	const guess = new Date(Date.UTC(y, m - 1, d, hh, mm));
	return new Date(guess.getTime() - offsetMinutes(guess) * 60_000);
}

/** The instant as `YYYY-MM-DD HH:mm` in Tunis time, for the model to read. */
export function toPracticeTime(date: Date): string {
	return new Intl.DateTimeFormat("sv-SE", {
		timeZone: PRACTICE_TIME_ZONE,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
	}).format(date);
}

/** Today's date and the time now, e.g. "Tuesday 2026-10-20 14:05". */
export function practiceNow(now = new Date()): string {
	const weekday = new Intl.DateTimeFormat("en-US", {
		timeZone: PRACTICE_TIME_ZONE,
		weekday: "long",
	}).format(now);
	return `${weekday} ${toPracticeTime(now)}`;
}
