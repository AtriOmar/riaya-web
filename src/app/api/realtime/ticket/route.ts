import type { NextRequest } from "next/server";
import { z } from "zod";
import {
	apiError,
	getDoctorProfile,
	json,
	requireAdmin,
	requireSession,
	validationError,
} from "@/lib/api-utils";
import { requirePractice } from "@/lib/practice";
import {
	type RealtimeTicketClaims,
	signRealtimeTicket,
} from "@/lib/realtime-ticket";

// ─── POST /api/realtime/ticket ───────────────────────────────────────────────
// A browser asks for a short-lived ticket before it opens a WebSocket or calls
// a route of the voice server. What the ticket allows depends on who asks.

const schema = z.object({
	scope: z.enum(["dashboard", "whatsapp", "test-call"]),
	/** whatsapp only: "admin" for the platform account, or the caller's own id */
	userId: z.string().min(1).optional(),
});

export async function POST(req: NextRequest) {
	try {
		const parsed = schema.safeParse(await req.json());
		if (!parsed.success) return validationError(parsed.error.issues);
		const { scope, userId } = parsed.data;

		let claims: RealtimeTicketClaims;
		if (scope === "test-call") {
			await requireAdmin();
			claims = { scope, admin: true };
		} else if (scope === "dashboard") {
			const session = await requireSession();
			if (session.user.accessId && session.user.accessId >= 3) {
				claims = { scope, admin: true };
			} else {
				// A doctor or secretary only gets their practice's booking events.
				const { doctor } = await requirePractice();
				claims = { scope, doctorId: doctor.id };
			}
		} else {
			if (!userId) return validationError([{ message: "userId is required" }]);
			if (userId === "admin") {
				await requireAdmin();
			} else {
				const session = await requireSession();
				const profile = await getDoctorProfile(session.user.id);
				if (!profile || userId !== session.user.id) {
					return apiError("FORBIDDEN");
				}
			}
			claims = { scope, userId };
		}

		return json({ ticket: signRealtimeTicket(claims) });
	} catch (e) {
		if (e instanceof Response) return e;
		return apiError("INTERNAL_ERROR");
	}
}
