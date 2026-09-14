/** HTTP base URL for the voice/realtime service (WhatsApp send, etc.). */
export function getRealtimeHttpUrl(): string | null {
	const url = process.env.NEXT_PUBLIC_REALTIME_URL?.trim();
	if (!url) return null;
	return url.replace(/^ws/, "http").replace(/\/$/, "");
}
