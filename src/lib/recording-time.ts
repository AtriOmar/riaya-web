/** "45 min", "3 h", "3 h 20 min" — for recording time allowances and balances. */
export function formatRecordingTime(seconds: number): string {
	const totalMinutes = Math.floor(Math.max(0, seconds) / 60);
	const h = Math.floor(totalMinutes / 60);
	const m = totalMinutes % 60;
	if (h === 0) return `${m} min`;
	if (m === 0) return `${h} h`;
	return `${h} h ${m} min`;
}
