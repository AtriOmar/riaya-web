import { and, desc, eq, sql } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { aiChatConversation, consultationRecording } from "@/db/schema";
import {
	apiError,
	json,
	requireDoctorProfile,
	requireSession,
	validationError,
} from "@/lib/api-utils";

// ─── GET /api/ai-chat/conversations ───────────────────────────────────────────
// Lists the doctor's conversations (newest first) with a preview of the last message.

export async function GET() {
	try {
		const session = await requireSession();
		const profile = await requireDoctorProfile(session.user.id);

		const conversations = await db
			.select({
				id: aiChatConversation.id,
				doctorId: aiChatConversation.doctorId,
				title: aiChatConversation.title,
				recordingId: aiChatConversation.recordingId,
				createdAt: aiChatConversation.createdAt,
				updatedAt: aiChatConversation.updatedAt,
				messageCount: sql<number>`(
					select count(*)::int from ai_chat_message
					where ai_chat_message.conversation_id = ${aiChatConversation.id}
				)`,
				preview: sql<string | null>`(
					select content from ai_chat_message
					where ai_chat_message.conversation_id = ${aiChatConversation.id}
					order by ai_chat_message.created_at desc
					limit 1
				)`,
			})
			.from(aiChatConversation)
			.where(eq(aiChatConversation.doctorId, profile.id))
			.orderBy(desc(aiChatConversation.updatedAt));

		return json(conversations);
	} catch (e) {
		if (e instanceof Response) return e;
		return apiError("INTERNAL_ERROR");
	}
}

// ─── POST /api/ai-chat/conversations ──────────────────────────────────────────
// Creates an empty conversation (optionally linked to a recording).

const createSchema = z.object({
	title: z.string().min(1).max(255).optional(),
	recordingId: z.number().int().positive().optional(),
});

export async function POST(req: NextRequest) {
	try {
		const session = await requireSession();
		const profile = await requireDoctorProfile(session.user.id);

		const body = await req.json();
		const parsed = createSchema.safeParse(body);
		if (!parsed.success) return validationError(parsed.error.issues);

		if (parsed.data.recordingId) {
			const [recording] = await db
				.select({ id: consultationRecording.id })
				.from(consultationRecording)
				.where(
					and(
						eq(consultationRecording.id, parsed.data.recordingId),
						eq(consultationRecording.doctorId, profile.id),
					),
				);
			if (!recording) return apiError("RECORDING_NOT_FOUND");
		}

		const [conversation] = await db
			.insert(aiChatConversation)
			.values({
				doctorId: profile.id,
				title: parsed.data.title ?? "New conversation",
				recordingId: parsed.data.recordingId ?? null,
			})
			.returning();

		return json(conversation, 201);
	} catch (e) {
		if (e instanceof Response) return e;
		return apiError("INTERNAL_ERROR");
	}
}

import {
	selectAiChatConversationListItemSchema,
	selectAiChatConversationSchema,
} from "@/db/zod";
import { registry } from "@/lib/openapi";

registry.registerPath({
	method: "get",
	path: "/api/ai-chat/conversations",
	tags: ["AiChat"],
	summary: "List AI chat conversations",
	responses: {
		200: {
			description: "List of conversations with preview",
			content: {
				"application/json": {
					schema: z.array(selectAiChatConversationListItemSchema),
				},
			},
		},
	},
});

registry.registerPath({
	method: "post",
	path: "/api/ai-chat/conversations",
	tags: ["AiChat"],
	summary: "Create AI chat conversation",
	request: {
		body: { content: { "application/json": { schema: createSchema } } },
	},
	responses: {
		201: {
			description: "Created conversation",
			content: {
				"application/json": { schema: selectAiChatConversationSchema },
			},
		},
	},
});
