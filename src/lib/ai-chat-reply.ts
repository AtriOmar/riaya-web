import { and, eq, inArray, lt } from "drizzle-orm";
import { db } from "@/db";
import {
	type AiChatMessageStatus,
	aiChatConversation,
	aiChatMessage,
	liveAiChatMessageStatuses,
} from "@/db/schema";
import { type ChatUsage, streamChatText } from "@/lib/ai";

// ─── Assistant replies that outlive the request ───────────────────────────────
// A reply is an `ai_chat_message` row created as `streaming`. Generation runs
// on its own, not tied to the HTTP response: if the doctor closes the page the
// reply still finishes and is saved. The content is saved every FLUSH_MS so a
// reopened page can show it growing. Stopping is done through the row: the
// stop route sets `stopping`; the next save notices, ends the model request
// and saves the text sent so far as `stopped`.

const FLUSH_MS = 750;

/**
 * A reply still `streaming` after this long was cut off (e.g. the server
 * restarted mid-reply). Replies are capped at 2048 tokens and finish well
 * within it.
 */
const STALE_REPLY_MS = 5 * 60 * 1000;

type ChatMessage = { role: "user" | "assistant"; content: string };

/** Marks replies cut off by a restart as failed, so they don't look live forever. */
export async function expireStaleReplies(conversationId: number) {
	await db
		.update(aiChatMessage)
		.set({ status: "failed" })
		.where(
			and(
				eq(aiChatMessage.conversationId, conversationId),
				inArray(aiChatMessage.status, liveAiChatMessageStatuses),
				lt(aiChatMessage.createdAt, new Date(Date.now() - STALE_REPLY_MS)),
			),
		);
}

export async function hasReplyInProgress(conversationId: number) {
	const [row] = await db
		.select({ id: aiChatMessage.id })
		.from(aiChatMessage)
		.where(
			and(
				eq(aiChatMessage.conversationId, conversationId),
				inArray(aiChatMessage.status, liveAiChatMessageStatuses),
			),
		)
		.limit(1);
	return Boolean(row);
}

/** Asks the conversation's live reply to stop. Its text so far is kept. */
export async function stopReply(conversationId: number) {
	await db
		.update(aiChatMessage)
		.set({ status: "stopping" })
		.where(
			and(
				eq(aiChatMessage.conversationId, conversationId),
				eq(aiChatMessage.status, "streaming"),
			),
		);
}

/**
 * Writes the reply into the `streaming` row `messageId`, calling `onDelta`
 * with each piece of text as it arrives. Resolves with the final status.
 */
export async function generateAssistantReply(options: {
	messageId: number;
	conversationId: number;
	instructions: string;
	messages: ChatMessage[];
	onDelta: (delta: string) => void;
}): Promise<AiChatMessageStatus> {
	const { messageId, conversationId } = options;
	const abort = new AbortController();
	let text = "";
	let usage: ChatUsage | null = null;
	let stopped = false;
	let lastFlush = Date.now();

	/** Saves the text so far; finds out if stop was asked or the reply deleted. */
	const flush = async () => {
		lastFlush = Date.now();
		const [row] = await db
			.update(aiChatMessage)
			.set({ content: text })
			.where(
				and(
					eq(aiChatMessage.id, messageId),
					eq(aiChatMessage.status, "streaming"),
				),
			)
			.returning({ id: aiChatMessage.id });
		if (!row) {
			stopped = true;
			abort.abort();
		}
	};

	try {
		for await (const delta of streamChatText({
			instructions: options.instructions,
			messages: options.messages,
			maxOutputTokens: 2048,
			signal: abort.signal,
			onUsage: (u) => {
				usage = u;
			},
		})) {
			text += delta;
			options.onDelta(delta);
			if (Date.now() - lastFlush >= FLUSH_MS) {
				await flush();
				if (stopped) break;
			}
		}
	} catch (err) {
		if (!stopped) {
			console.error("AI chat reply failed:", err);
			await finish("failed", text, null);
			return "failed";
		}
	}

	// Usage only arrives at the end of the model stream, so a stopped reply
	// has none.
	const status = stopped ? "stopped" : "done";
	await finish(status, text, usage);
	return status;

	async function finish(
		status: AiChatMessageStatus,
		content: string,
		used: ChatUsage | null,
	) {
		await db
			.update(aiChatMessage)
			.set({
				status,
				content,
				promptTokens: used?.promptTokens ?? null,
				completionTokens: used?.completionTokens ?? null,
				costMicroUsd: used?.costMicroUsd ?? null,
			})
			.where(eq(aiChatMessage.id, messageId));
		await db
			.update(aiChatConversation)
			.set({ updatedAt: new Date() })
			.where(eq(aiChatConversation.id, conversationId));
	}
}
