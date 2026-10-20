/**
 * A recording's display name: its title, or "Consultation · 18 Oct, 14:30"
 * until one exists (still transcribing, no transcript, or naming failed).
 * Derived, never stored, so a generated title replaces it cleanly.
 */
export function recordingTitle(recording: {
	title: string | null;
	createdAt: string | null;
}): string {
	if (recording.title?.trim()) return recording.title;
	const date = recording.createdAt ? new Date(recording.createdAt) : null;
	if (!date || Number.isNaN(date.getTime())) return "Consultation";
	const day = date.toLocaleDateString("en-GB", {
		day: "numeric",
		month: "short",
	});
	const time = date.toLocaleTimeString("en-GB", {
		hour: "2-digit",
		minute: "2-digit",
	});
	return `Consultation · ${day}, ${time}`;
}
