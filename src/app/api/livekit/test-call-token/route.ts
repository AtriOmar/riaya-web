import { randomUUID } from "node:crypto";
import {
	AccessToken,
	RoomAgentDispatch,
	RoomConfiguration,
} from "livekit-server-sdk";
import { z } from "zod";
import { apiError, json, requireAdmin, validationError } from "@/lib/api-utils";
import { normalizePhoneForStorage } from "@/lib/phone";

// ─── POST /api/livekit/test-call-token ────────────────────────────────────────
// Admin-only: mints a LiveKit room token for the /test-call page so the browser
// can talk to the LiveKit voice agent directly (WebRTC). The room config
// dispatches the agent; caller phone + CallSid travel as participant attributes
// (the agent reads them like it reads SIP attributes on real calls).

const AGENT_NAME = process.env.LIVEKIT_AGENT_NAME?.trim() || "riaya-agent";
const TOKEN_TTL = "15m";

const bodySchema = z.object({
	phoneNumber: z.string().min(1),
});

const responseSchema = z.object({
	token: z.string(),
	url: z.string(),
	callSid: z.string(),
	roomName: z.string(),
});

export async function POST(req: Request) {
	try {
		const session = await requireAdmin();

		const url = process.env.LIVEKIT_URL?.trim();
		const apiKey = process.env.LIVEKIT_API_KEY?.trim();
		const apiSecret = process.env.LIVEKIT_API_SECRET?.trim();
		if (!url || !apiKey || !apiSecret)
			return apiError("LIVEKIT_NOT_CONFIGURED");

		const parsed = bodySchema.safeParse(await req.json());
		if (!parsed.success) return validationError(parsed.error.issues);
		const callerPhone = normalizePhoneForStorage(parsed.data.phoneNumber);
		if (!callerPhone) {
			return validationError([
				{ path: ["phoneNumber"], message: "Invalid phone number" },
			]);
		}

		// `CA_SIM` prefix: /api/calls skips Twilio recording for simulated calls.
		const callSid = `CA_SIM_LK_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
		const roomName = `test-${callSid}`;

		const token = new AccessToken(apiKey, apiSecret, {
			identity: `test-caller-${session.user.id}`,
			name: "Test caller",
			ttl: TOKEN_TTL,
			attributes: { callerPhone, callSid, simulated: "true" },
		});
		token.addGrant({
			roomJoin: true,
			room: roomName,
			canPublish: true,
			canSubscribe: true,
		});
		token.roomConfig = new RoomConfiguration({
			agents: [new RoomAgentDispatch({ agentName: AGENT_NAME })],
		});

		return json({ token: await token.toJwt(), url, callSid, roomName });
	} catch (e) {
		if (e instanceof Response) return e;
		return apiError("INTERNAL_ERROR");
	}
}

import { registry } from "@/lib/openapi";

registry.registerPath({
	method: "post",
	path: "/api/livekit/test-call-token",
	tags: ["TestCall"],
	summary: "Create a LiveKit test-call token (Admin)",
	request: {
		body: {
			content: {
				"application/json": {
					schema: bodySchema,
				},
			},
		},
	},
	responses: {
		200: {
			description: "LiveKit room token for a browser test call",
			content: {
				"application/json": {
					schema: responseSchema,
				},
			},
		},
	},
});
