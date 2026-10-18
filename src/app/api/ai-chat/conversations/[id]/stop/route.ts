import { and, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { aiChatConversation } from "@/db/schema";
import { stopReply } from "@/lib/ai-chat-reply";
import {
	apiError,
	json,
	requireDoctorProfile,
	requireSession,
} from "@/lib/api-utils";

type RouteContext = { params: Promise<{ id: string }> };

// ─── POST /api/ai-chat/conversations/[id]/stop ────────────────────────────────
// Stops the conversation's live assistant reply, keeping the text so far.
// Does nothing when no reply is being written.

export async function POST(_req: NextRequest, { params }: RouteContext) {
	try {
		const session = await requireSession();
		const profile = await requireDoctorProfile(session.user.id);

		const { id } = await params;
		const conversationId = Number(id);
		if (Number.isNaN(conversationId)) return apiError("INVALID_ID");

		const [conversation] = await db
			.select({ id: aiChatConversation.id })
			.from(aiChatConversation)
			.where(
				and(
					eq(aiChatConversation.id, conversationId),
					eq(aiChatConversation.doctorId, profile.id),
				),
			);
		if (!conversation) return apiError("CONVERSATION_NOT_FOUND");

		await stopReply(conversationId);
		return json({ message: "Reply stopped" });
	} catch (e) {
		if (e instanceof Response) return e;
		return apiError("INTERNAL_ERROR");
	}
}

import { registry } from "@/lib/openapi";

registry.registerPath({
	method: "post",
	path: "/api/ai-chat/conversations/{id}/stop",
	tags: ["AiChat"],
	summary: "Stop the conversation's assistant reply that is being written",
	request: { params: z.object({ id: z.string() }) },
	responses: {
		200: {
			description: "Stopped (or nothing was being written)",
			content: {
				"application/json": {
					schema: z.object({ message: z.string() }),
				},
			},
		},
	},
});
