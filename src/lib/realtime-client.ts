/**
 * Browser side of the voice-server tickets: asks the web app for a short-lived
 * ticket that the voice server accepts for one kind of connection.
 */
export async function fetchRealtimeTicket(
	scope: "dashboard" | "whatsapp" | "test-call",
	userId?: string,
): Promise<string | null> {
	try {
		const res = await fetch("/api/realtime/ticket", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ scope, userId }),
		});
		if (!res.ok) return null;
		const data = (await res.json()) as { ticket?: string };
		return data.ticket ?? null;
	} catch {
		return null;
	}
}
