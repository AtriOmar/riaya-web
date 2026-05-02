import { createHmac } from "node:crypto";
import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { db } from "@/db";
import { call } from "@/db/schema";
import { uploadBufferToR2 } from "@/lib/r2";

// ─── POST /api/calls/recording-webhook ───────────────────────────────────────
// Twilio recording status callback. When a recording completes, Twilio POSTs
// form-encoded metadata. We download the recording, push it to R2, and update
// the call row with the CDN URL + key.
//
// This endpoint is public but authenticated via Twilio's X-Twilio-Signature
// header (validated with the shared auth token).

function validateTwilioSignature(
	authToken: string,
	url: string,
	params: Record<string, string>,
	signature: string,
): boolean {
	const sorted = Object.keys(params).sort();
	let data = url;
	for (const key of sorted) data += key + params[key];
	const expected = createHmac("sha1", authToken)
		.update(Buffer.from(data, "utf-8"))
		.digest("base64");
	return expected === signature;
}

async function downloadTwilioRecording(
	recordingUrl: string,
	accountSid: string,
	authToken: string,
): Promise<{ buffer: Buffer; contentType: string }> {
	// Twilio recording URLs accept .mp3 or .wav; prefer mp3 for smaller size.
	const mediaUrl = recordingUrl.endsWith(".mp3")
		? recordingUrl
		: `${recordingUrl}.mp3`;
	const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
	const res = await fetch(mediaUrl, {
		headers: { Authorization: `Basic ${auth}` },
	});
	if (!res.ok) {
		throw new Error(
			`Failed to download recording: ${res.status} ${res.statusText}`,
		);
	}
	const arr = new Uint8Array(await res.arrayBuffer());
	return {
		buffer: Buffer.from(arr),
		contentType: res.headers.get("content-type") ?? "audio/mpeg",
	};
}

export async function POST(req: NextRequest) {
	const accountSid = process.env.TWILIO_ACCOUNT_SID;
	const authToken = process.env.TWILIO_AUTH_TOKEN;
	if (!accountSid || !authToken) {
		console.error(
			"[recording-webhook] TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN not configured",
		);
		return Response.json({ error: "NOT_CONFIGURED" }, { status: 500 });
	}

	// Twilio sends application/x-www-form-urlencoded
	const raw = await req.text();
	const formParams = Object.fromEntries(new URLSearchParams(raw));
	const signature = req.headers.get("x-twilio-signature") ?? "";

	// Reconstruct the full URL Twilio signed (respecting the public app URL).
	const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
	const fullUrl = `${appUrl}/api/calls/recording-webhook`;

	if (!validateTwilioSignature(authToken, fullUrl, formParams, signature)) {
		console.error("[recording-webhook] invalid Twilio signature");
		return Response.json({ error: "INVALID_SIGNATURE" }, { status: 403 });
	}

	const callSid = formParams.CallSid;
	const recordingSid = formParams.RecordingSid;
	const recordingUrl = formParams.RecordingUrl;
	const recordingStatus = formParams.RecordingStatus;

	if (!callSid || !recordingSid || !recordingUrl) {
		return Response.json({ error: "MISSING_FIELDS" }, { status: 400 });
	}

	if (recordingStatus && recordingStatus !== "completed") {
		// Only process completed recordings.
		return Response.json({ ok: true, ignored: recordingStatus });
	}

	try {
		const { buffer, contentType } = await downloadTwilioRecording(
			recordingUrl,
			accountSid,
			authToken,
		);

		const key = `calls/recordings/${recordingSid}.mp3`;
		const cdnUrl = await uploadBufferToR2(key, buffer, contentType);

		await db
			.update(call)
			.set({
				recordingSid,
				recordingKey: key,
				recordingUrl: cdnUrl,
				updatedAt: new Date(),
			})
			.where(eq(call.callSid, callSid));

		return Response.json({ ok: true, cdnUrl });
	} catch (err) {
		console.error("[recording-webhook] error processing recording", err);
		return Response.json({ error: "INTERNAL_ERROR" }, { status: 500 });
	}
}
