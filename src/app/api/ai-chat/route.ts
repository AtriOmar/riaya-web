import { and, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import {
	aiChatConversation,
	aiChatMessage,
	consultationRecording,
} from "@/db/schema";
import { buildAssistantInstructions } from "@/lib/ai-assistant-prompt";
import {
	expireStaleReplies,
	generateAssistantReply,
	hasReplyInProgress,
} from "@/lib/ai-chat-reply";
import {
	apiError,
	requireDoctorProfile,
	requireSession,
} from "@/lib/api-utils";
import { assertAiAllowed } from "@/lib/plan-limits";

// ─── POST /api/ai-chat ────────────────────────────────────────────────────────
// Starts an assistant reply (see lib/ai-chat-reply.ts) and streams it back.
// The reply is saved even if the client disconnects.
//
// Body:
//   messages: ChatMessage[]          — full history including the new user message
//   conversationId?: number          — existing conversation (created if omitted)
//   recordingId?: number             — optional recording link when creating
//   transcriptContext?: string       — optional transcript injected as system context
//
// Response: plain text stream of the assistant reply.
// Header: X-Conversation-Id — the conversation id (new or existing).

/**
 * Only the latest turns go to the model: every message re-sends the history,
 * so long chats would cost more per question without better answers. An
 * attached transcript is part of the instructions and always included.
 */
const HISTORY_LIMIT = 20;

const messageSchema = z.object({
	role: z.enum(["user", "assistant"]),
	content: z.string(),
});

const bodySchema = z.object({
	messages: z.array(messageSchema).min(1),
	conversationId: z.number().int().positive().optional(),
	recordingId: z.number().int().positive().optional(),
	transcriptContext: z.string().optional(),
});

function titleFromFirstUserMessage(
	messages: { role: string; content: string }[],
) {
	const first = messages.find((m) => m.role === "user");
	if (!first) return "New conversation";
	const trimmed = first.content.trim().replace(/\s+/g, " ");
	return trimmed.length > 60 ? `${trimmed.slice(0, 57)}…` : trimmed;
}

export async function POST(req: NextRequest) {
	try {
		const session = await requireSession();
		const profile = await requireDoctorProfile(session.user.id);

		const body = await req.json();
		const parsed = bodySchema.safeParse(body);
		if (!parsed.success) {
			return Response.json(
				{ error: "VALIDATION_ERROR", issues: parsed.error.issues },
				{ status: 400 },
			);
		}

		const { messages, transcriptContext } = parsed.data;
		let conversationId = parsed.data.conversationId ?? null;

		const lastUser = [...messages].reverse().find((m) => m.role === "user");
		if (!lastUser) {
			return Response.json(
				{ error: "VALIDATION_ERROR", issues: [{ message: "No user message" }] },
				{ status: 400 },
			);
		}

		await assertAiAllowed(profile.id);

		// Resolve / create conversation
		if (conversationId) {
			const [existing] = await db
				.select({ id: aiChatConversation.id })
				.from(aiChatConversation)
				.where(
					and(
						eq(aiChatConversation.id, conversationId),
						eq(aiChatConversation.doctorId, profile.id),
					),
				);
			if (!existing) return apiError("CONVERSATION_NOT_FOUND");
		} else {
			const recordingId: number | null = parsed.data.recordingId ?? null;
			if (recordingId) {
				const [recording] = await db
					.select({ id: consultationRecording.id })
					.from(consultationRecording)
					.where(
						and(
							eq(consultationRecording.id, recordingId),
							eq(consultationRecording.doctorId, profile.id),
						),
					);
				if (!recording) return apiError("RECORDING_NOT_FOUND");
			}

			const [created] = await db
				.insert(aiChatConversation)
				.values({
					doctorId: profile.id,
					title: titleFromFirstUserMessage(messages),
					recordingId,
				})
				.returning();
			conversationId = created.id;
		}

		await expireStaleReplies(conversationId);
		if (await hasReplyInProgress(conversationId)) {
			return apiError("AI_REPLY_IN_PROGRESS");
		}

		// Persist the user turn, then the reply as `streaming`
		await db.insert(aiChatMessage).values({
			conversationId,
			role: "user",
			content: lastUser.content,
		});
		const [reply] = await db
			.insert(aiChatMessage)
			.values({
				conversationId,
				role: "assistant",
				content: "",
				status: "streaming",
			})
			.returning({ id: aiChatMessage.id });
		await db
			.update(aiChatConversation)
			.set({ updatedAt: new Date() })
			.where(eq(aiChatConversation.id, conversationId));

		// The reply is generated on its own and keeps going if the doctor leaves;
		// this response only mirrors it while the page is open.
		const encoder = new TextEncoder();
		let client: ReadableStreamDefaultController<Uint8Array> | null = null;
		const readable = new ReadableStream<Uint8Array>({
			start(controller) {
				client = controller;
			},
			cancel() {
				client = null;
			},
		});

		const savedConversationId = conversationId;
		void generateAssistantReply({
			messageId: reply.id,
			conversationId,
			instructions: buildAssistantInstructions(transcriptContext),
			// Empty turns are failed or stopped-before-any-text replies
			messages: messages.filter((m) => m.content.trim()).slice(-HISTORY_LIMIT),
			onDelta: (delta) => {
				try {
					client?.enqueue(encoder.encode(delta));
				} catch {
					client = null;
				}
			},
		}).then(
			(status) => {
				try {
					if (status === "failed") client?.error(new Error("Reply failed"));
					else client?.close();
				} catch {
					// The page already went away
				}
			},
			(err) => {
				console.error("AI chat reply error:", err);
				try {
					client?.error(err);
				} catch {
					// The page already went away
				}
			},
		);

		return new Response(readable, {
			headers: {
				"Content-Type": "text/plain; charset=utf-8",
				"Cache-Control": "no-cache, no-transform",
				"X-Accel-Buffering": "no",
				"X-Content-Type-Options": "nosniff",
				"X-Conversation-Id": String(savedConversationId),
			},
		});
	} catch (e) {
		if (e instanceof Response) return e;
		console.error("AI chat error:", e);
		return apiError("INTERNAL_ERROR");
	}
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Streaming endpoint — not registered in OpenAPI (plain text stream).
