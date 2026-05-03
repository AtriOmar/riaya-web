import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { call } from "@/db/schema";
import { apiError, json, requireAdmin, validationError } from "@/lib/api-utils";

// ─── GET /api/calls ───────────────────────────────────────────────────────────
// Admin-only: returns all calls with their events, ordered by most recent first.

export async function GET() {
	try {
		await requireAdmin();

		const calls = await db.query.call.findMany({
			orderBy: (t, { desc }) => [desc(t.startedAt)],
			with: {
				events: {
					orderBy: (e, { asc }) => [asc(e.timestamp)],
				},
			},
		});

		return json(calls);
	} catch (e) {
		if (e instanceof Response) return e;
		return apiError("INTERNAL_ERROR");
	}
}

// ─── POST /api/calls ──────────────────────────────────────────────────────────
// Internal: called by the realtime socket on incoming-call webhook.
// Creates the call row and (if configured) asks Twilio to start a recording.

const createSchema = z.object({
	callSid: z.string().min(1),
	from: z.string().optional(),
	to: z.string().optional(),
	direction: z.string().optional(),
});

async function startTwilioRecording(callSid: string): Promise<string | null> {
	const sid = process.env.TWILIO_ACCOUNT_SID;
	const token = process.env.TWILIO_AUTH_TOKEN;
	const appUrl = process.env.NEXT_PUBLIC_APP_URL;
	if (!sid || !token || !appUrl) return null;

	const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Calls/${callSid}/Recordings.json`;
	const recordingStatusCallback = `${appUrl.replace(/\/$/, "")}/api/calls/recording-webhook`;

	const body = new URLSearchParams({
		RecordingStatusCallback: recordingStatusCallback,
		RecordingStatusCallbackEvent: "completed",
		RecordingChannels: "dual",
	});

	const auth = Buffer.from(`${sid}:${token}`).toString("base64");

	try {
		const res = await fetch(url, {
			method: "POST",
			headers: {
				Authorization: `Basic ${auth}`,
				"Content-Type": "application/x-www-form-urlencoded",
			},
			body: body.toString(),
		});
		if (!res.ok) {
			console.error(
				"[calls] Failed to start Twilio recording",
				res.status,
				await res.text().catch(() => ""),
			);
			return null;
		}
		const data = (await res.json()) as { sid?: string };
		return data.sid ?? null;
	} catch (err) {
		console.error("[calls] Error starting Twilio recording", err);
		return null;
	}
}

export async function POST(req: NextRequest) {
	try {
		// await requireInternal(req);

		const body = await req.json();
		const parsed = createSchema.safeParse(body);
		if (!parsed.success) return validationError(parsed.error.issues);

		const [created] = await db
			.insert(call)
			.values({
				callSid: parsed.data.callSid,
				from: parsed.data.from,
				to: parsed.data.to,
				direction: parsed.data.direction,
				status: "in-progress",
				startedAt: new Date(),
			})
			.onConflictDoNothing({ target: call.callSid })
			.returning();

		// If the call already exists (e.g. retry), fetch the existing row.
		const row =
			created ??
			(await db.query.call.findFirst({
				where: (t, { eq }) => eq(t.callSid, parsed.data.callSid),
			}));

		if (!row) return apiError("INTERNAL_ERROR");

		// Fire-and-forget recording start (don't block the socket response).
		startTwilioRecording(parsed.data.callSid)
			.then(async (recordingSid) => {
				if (recordingSid) {
					await db
						.update(call)
						.set({ recordingSid, updatedAt: new Date() })
						.where(eq(call.id, row.id));
				}
			})
			.catch((err) =>
				console.error("[calls] startTwilioRecording failed", err),
			);

		return json(row, 201);
	} catch (e) {
		if (e instanceof Response) return e;
		return apiError("INTERNAL_ERROR");
	}
}
