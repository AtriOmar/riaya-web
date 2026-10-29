import { createHmac } from "node:crypto";

/**
 * Short-lived ticket for the voice server, signed with the secret both services
 * share. The voice server checks the signature and the scope before it accepts
 * a WebSocket or a WhatsApp call from a browser. The format is read by
 * `src/auth/tickets.ts` in the voice repository.
 */
export type RealtimeTicketClaims = {
	scope: "dashboard" | "whatsapp" | "test-call";
	admin?: boolean;
	doctorId?: number;
	userId?: string;
};

const TICKET_TTL_SECONDS = 60;

export function signRealtimeTicket(claims: RealtimeTicketClaims): string {
	const body = Buffer.from(
		JSON.stringify({
			...claims,
			exp: Math.floor(Date.now() / 1000) + TICKET_TTL_SECONDS,
		}),
	).toString("base64url");
	const signature = createHmac("sha256", process.env.INTERNAL_API_SECRET ?? "")
		.update(body)
		.digest("base64url");
	return `${body}.${signature}`;
}
