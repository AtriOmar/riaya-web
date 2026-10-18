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
import type { ReplyEvent } from "@/lib/ai-chat-parts";
import {
	buildModelHistory,
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
//   message: string                  — the doctor's new message
//   conversationId?: number          — existing conversation (created if omitted)
//   recordingId?: number             — optional recording link when creating
//   transcriptContext?: string       — optional transcript injected as system context
//
// The history comes from the saved conversation, not from the client.
// Response: one JSON `ReplyEvent` per line while the reply is written.
// Header: X-Conversation-Id — the conversation id (new or existing).

const bodySchema = z.object({
	message: z.string().trim().min(1),
	conversationId: z.number().int().positive().optional(),
	recordingId: z.number().int().positive().optional(),
	transcriptContext: z.string().optional(),
});

function titleFromMessage(message: string) {
	const trimmed = message.replace(/\s+/g, " ");
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

		const { message, transcriptContext } = parsed.data;
		let conversationId = parsed.data.conversationId ?? null;

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
					title: titleFromMessage(message),
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
			parts: [{ type: "text", text: message }],
		});
		const [reply] = await db
			.insert(aiChatMessage)
			.values({
				conversationId,
				role: "assistant",
				parts: [],
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
		const send = (event: ReplyEvent) => {
			try {
				client?.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
			} catch {
				client = null;
			}
		};
		void generateAssistantReply({
			messageId: reply.id,
			conversationId,
			doctorId: profile.id,
			instructions: buildAssistantInstructions(transcriptContext),
			history: await buildModelHistory(conversationId, reply.id),
			onEvent: send,
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
				"Content-Type": "application/x-ndjson; charset=utf-8",
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

// Streaming endpoint — not registered in OpenAPI (JSON lines stream).
