type WithTranscriptStatus = { transcriptStatus?: string | null };

/**
 * SWR `refreshInterval` for recordings: poll every few seconds while any
 * transcript is still processing (transcription runs in the background).
 */
export function transcriptRefreshInterval(
	data: WithTranscriptStatus | WithTranscriptStatus[] | undefined,
) {
	const items = Array.isArray(data) ? data : data ? [data] : [];
	return items.some((r) => r.transcriptStatus === "processing") ? 4000 : 0;
}
