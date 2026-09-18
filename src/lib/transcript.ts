/**
 * Speaker labels from OpenRouter/Azure diarization are 0-based indexes.
 * Missing values stay as a generic "Speaker".
 */
export function formatSpeakerLabel(speaker: unknown): string {
	if (speaker === null || speaker === undefined || speaker === "") {
		return "Speaker";
	}
	if (typeof speaker === "number" && Number.isFinite(speaker)) {
		return `Speaker ${speaker + 1}`;
	}
	const text = String(speaker).trim();
	if (/^\d+$/.test(text)) {
		return `Speaker ${Number(text) + 1}`;
	}
	return text;
}
