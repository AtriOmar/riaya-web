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
	apiError,
	requireDoctorProfile,
	requireSession,
} from "@/lib/api-utils";
import { streamChatText } from "@/lib/azure-ai";

// ─── POST /api/ai-chat ────────────────────────────────────────────────────────
// Streams a chat completion from Azure OpenAI and persists the turn.
//
// Body:
//   messages: ChatMessage[]          — full history including the new user message
//   conversationId?: number          — existing conversation (created if omitted)
//   recordingId?: number             — optional recording link when creating
//   transcriptContext?: string       — optional transcript injected as system context
//
// Response: plain text stream of the assistant reply.
// Header: X-Conversation-Id — the conversation id (new or existing).

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

		// Persist the user turn
		await db.insert(aiChatMessage).values({
			conversationId,
			role: "user",
			content: lastUser.content,
		});
		await db
			.update(aiChatConversation)
			.set({ updatedAt: new Date() })
			.where(eq(aiChatConversation.id, conversationId));

		const clientStream = streamChatText({
			instructions: buildAssistantInstructions(transcriptContext),
			messages,
			maxOutputTokens: 2048,
		});

		const encoder = new TextEncoder();
		const savedConversationId = conversationId;

		const readable = new ReadableStream({
			async start(controller) {
				let assistantText = "";
				try {
					for await (const delta of clientStream) {
						assistantText += delta;
						controller.enqueue(encoder.encode(delta));
					}

					if (assistantText.trim()) {
						await db.insert(aiChatMessage).values({
							conversationId: savedConversationId,
							role: "assistant",
							content: assistantText,
						});
						await db
							.update(aiChatConversation)
							.set({ updatedAt: new Date() })
							.where(eq(aiChatConversation.id, savedConversationId));
					}
				} catch (err) {
					console.error("AI chat stream error:", err);
					controller.error(err);
					return;
				}
				controller.close();
			},
		});

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
