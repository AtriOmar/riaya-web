import { and, desc, eq, inArray, lt, ne } from "drizzle-orm";
import { db } from "@/db";
import {
	type AiChatMessageStatus,
	aiChatConversation,
	aiChatMessage,
	liveAiChatMessageStatuses,
} from "@/db/schema";
import {
	type ChatMessage,
	type ChatToolCall,
	type ChatUsage,
	streamChatTurn,
} from "@/lib/ai";
import {
	type AiActionPart,
	type AiChatPart,
	type AiToolPart,
	partsText,
	type ReplyEvent,
} from "@/lib/ai-chat-parts";
import {
	actionModelContent,
	CHAT_TOOLS,
	prepareToolCall,
	toModelJson,
} from "@/lib/ai-tools";

// ─── Assistant replies that outlive the request ───────────────────────────────
// A reply is an `ai_chat_message` row created as `streaming`. Generation runs
// on its own, not tied to the HTTP response: if the doctor closes the page the
// reply still finishes and is saved. Its parts are saved every FLUSH_MS so a
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

/** Model calls per reply: each one may run tools and then continue. */
const MAX_STEPS = 6;

/** Recent messages sent back to the model with each new question. */
const HISTORY_LIMIT = 20;

/** Assistant replies whose full tool results are replayed; older ones are cut. */
const FULL_RESULT_REPLIES = 2;

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

function toolCallOf(part: AiToolPart | AiActionPart) {
	return {
		id: part.id,
		type: "function" as const,
		function: {
			name: part.name,
			arguments: JSON.stringify(
				part.type === "tool" ? part.args : part.proposal,
			),
		},
	};
}

function toolResultOf(part: AiToolPart | AiActionPart, full: boolean): string {
	if (part.type === "action") return actionModelContent(part);
	if (part.status === "running") return "This lookup did not finish.";
	if (part.status === "error") return `Error: ${part.error ?? "lookup failed"}`;
	return full
		? toModelJson(part.result)
		: "Result left out to save space. Call the tool again if you need it.";
}

/**
 * The conversation so far, as model messages, built from the saved parts.
 * `excludeMessageId` is the reply being written.
 */
export async function buildModelHistory(
	conversationId: number,
	excludeMessageId: number,
): Promise<ChatMessage[]> {
	const rows = (
		await db
			.select({ role: aiChatMessage.role, parts: aiChatMessage.parts })
			.from(aiChatMessage)
			.where(
				and(
					eq(aiChatMessage.conversationId, conversationId),
					ne(aiChatMessage.id, excludeMessageId),
				),
			)
			.orderBy(desc(aiChatMessage.createdAt), desc(aiChatMessage.id))
			.limit(HISTORY_LIMIT)
	).reverse();

	const assistantCount = rows.filter((r) => r.role === "assistant").length;
	let assistantSeen = 0;
	const messages: ChatMessage[] = [];

	for (const row of rows) {
		if (row.role === "user") {
			messages.push({ role: "user", content: partsText(row.parts) });
			continue;
		}
		assistantSeen++;
		const full = assistantCount - assistantSeen < FULL_RESULT_REPLIES;
		let text = "";
		let calls: (AiToolPart | AiActionPart)[] = [];
		const flushCalls = () => {
			if (!calls.length) return;
			messages.push({
				role: "assistant",
				content: text || null,
				tool_calls: calls.map(toolCallOf),
			});
			for (const call of calls) {
				messages.push({
					role: "tool",
					tool_call_id: call.id,
					content: toolResultOf(call, full),
				});
			}
			text = "";
			calls = [];
		};
		for (const part of row.parts) {
			if (part.type === "text") {
				flushCalls();
				text += part.text;
			} else {
				calls.push(part);
			}
		}
		flushCalls();
		if (text.trim()) messages.push({ role: "assistant", content: text });
	}
	return messages;
}

/**
 * Writes the reply into the `streaming` row `messageId`: model turns, the
 * tools they call and the actions they propose, until a turn answers without
 * tools. `onEvent` mirrors each change to the page. Resolves with the final
 * status.
 */
export async function generateAssistantReply(options: {
	messageId: number;
	conversationId: number;
	doctorId: number;
	instructions: string;
	history: ChatMessage[];
	onEvent: (event: ReplyEvent) => void;
}): Promise<AiChatMessageStatus> {
	const { messageId, conversationId } = options;
	const ctx = { doctorId: options.doctorId };
	const abort = new AbortController();
	const parts: AiChatPart[] = [];
	const model: ChatMessage[] = [
		{ role: "system", content: options.instructions },
		...options.history,
	];
	const used: ChatUsage = {
		promptTokens: 0,
		completionTokens: 0,
		costMicroUsd: null,
	};
	let stopped = false;
	let lastFlush = Date.now();
	let flushing: Promise<void> | null = null;

	/** Saves the parts so far; finds out if stop was asked or the reply deleted. */
	const flush = async () => {
		const [row] = await db
			.update(aiChatMessage)
			.set({ parts: structuredClone(parts) })
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
	const saveSoon = (now = false) => {
		if (flushing || (!now && Date.now() - lastFlush < FLUSH_MS)) return;
		lastFlush = Date.now();
		flushing = flush().finally(() => {
			flushing = null;
		});
	};

	const setPart = (index: number, part: AiChatPart) => {
		parts[index] = part;
		options.onEvent({ type: "part", index, part });
		saveSoon(true);
	};

	let stepText = "";
	const appendText = (delta: string) => {
		stepText += delta;
		const last = parts.at(-1);
		if (last?.type === "text") last.text += delta;
		else parts.push({ type: "text", text: delta });
		options.onEvent({ type: "text", delta });
		saveSoon();
	};

	const runCall = async (call: ChatToolCall): Promise<string> => {
		const prepared = await prepareToolCall(ctx, call);
		if (prepared.kind === "invalid") return `Error: ${prepared.message}`;
		const index = parts.length;
		setPart(index, prepared.part);
		if (prepared.kind === "action") return actionModelContent(prepared.part);
		const done = await prepared.run();
		setPart(index, done);
		return toolResultOf(done, true);
	};

	let status: AiChatMessageStatus = "done";
	try {
		for (let step = 0; step < MAX_STEPS && !stopped; step++) {
			stepText = "";
			const { toolCalls, usage } = await streamChatTurn({
				messages: model,
				tools: CHAT_TOOLS,
				signal: abort.signal,
				onTextDelta: appendText,
			});
			if (usage) {
				used.promptTokens += usage.promptTokens;
				used.completionTokens += usage.completionTokens;
				if (usage.costMicroUsd != null) {
					used.costMicroUsd = (used.costMicroUsd ?? 0) + usage.costMicroUsd;
				}
			}
			if (!toolCalls.length) break;

			model.push({
				role: "assistant",
				content: stepText || null,
				tool_calls: toolCalls.map((c) => ({
					id: c.id,
					type: "function",
					function: { name: c.name, arguments: c.arguments || "{}" },
				})),
			});
			for (const call of toolCalls) {
				const content = stopped
					? "Stopped by the doctor."
					: await runCall(call);
				model.push({ role: "tool", tool_call_id: call.id, content });
			}
		}
		if (stopped) status = "stopped";
	} catch (err) {
		if (stopped) {
			status = "stopped";
		} else {
			console.error("AI chat reply failed:", err);
			status = "failed";
		}
	}

	// A stopped model stream never reports usage, so a stopped reply may have none
	await flushing;
	for (const [index, part] of parts.entries()) {
		if (part.type === "tool" && part.status === "running") {
			setPart(index, { ...part, status: "error", error: "Did not finish." });
		}
	}
	await flushing;
	const hasUsage = used.promptTokens > 0 || used.completionTokens > 0;
	await db
		.update(aiChatMessage)
		.set({
			status,
			parts,
			promptTokens: hasUsage ? used.promptTokens : null,
			completionTokens: hasUsage ? used.completionTokens : null,
			costMicroUsd: used.costMicroUsd,
		})
		.where(eq(aiChatMessage.id, messageId));
	await db
		.update(aiChatConversation)
		.set({ updatedAt: new Date() })
		.where(eq(aiChatConversation.id, conversationId));
	return status;
}
