import { useEffect } from "react";

type WithTranscriptStatus = {
	transcriptStatus?: string | null;
	summaryStatus?: string | null;
};

const POLL_MS = 3000;

/**
 * Re-fetches recordings every few seconds while any transcript or AI summary
 * is still being written in the background.
 *
 * Not SWR's `refreshInterval` function: SWR reads it once on mount, when there
 * is no data yet, so polling would never start for a freshly saved recording.
 */
export function useTranscriptPolling(
	data: WithTranscriptStatus | WithTranscriptStatus[] | undefined,
	mutate: () => unknown,
) {
	const items = Array.isArray(data) ? data : data ? [data] : [];
	const pending = items.some(
		(r) =>
			r.transcriptStatus === "processing" || r.summaryStatus === "processing",
	);

	useEffect(() => {
		if (!pending) return;
		const timer = setInterval(() => void mutate(), POLL_MS);
		return () => clearInterval(timer);
	}, [pending, mutate]);
}
