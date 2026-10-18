type WithTranscriptStatus = {
	transcriptStatus?: string | null;
	summaryStatus?: string | null;
};

/**
 * SWR `refreshInterval` for recordings: poll every few seconds while any
 * transcript or AI summary is still being written in the background.
 */
export function transcriptRefreshInterval(
	data: WithTranscriptStatus | WithTranscriptStatus[] | undefined,
) {
	const items = Array.isArray(data) ? data : data ? [data] : [];
	return items.some(
		(r) =>
			r.transcriptStatus === "processing" || r.summaryStatus === "processing",
	)
		? 4000
		: 0;
}
