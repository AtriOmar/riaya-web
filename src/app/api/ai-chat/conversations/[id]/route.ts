import { and, asc, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import {
	aiChatConversation,
	aiChatMessage,
	consultationRecording,
} from "@/db/schema";
import {
	apiError,
	json,
	requireDoctorProfile,
	requireSession,
	validationError,
} from "@/lib/api-utils";

type RouteContext = { params: Promise<{ id: string }> };

// ─── GET /api/ai-chat/conversations/[id] ──────────────────────────────────────

export async function GET(_req: NextRequest, { params }: RouteContext) {
	try {
		const session = await requireSession();
		const profile = await requireDoctorProfile(session.user.id);

		const { id } = await params;
		const conversationId = Number(id);
		if (Number.isNaN(conversationId)) return apiError("INVALID_ID");

		const [conversation] = await db
			.select({
				id: aiChatConversation.id,
				doctorId: aiChatConversation.doctorId,
				title: aiChatConversation.title,
				recordingId: aiChatConversation.recordingId,
				createdAt: aiChatConversation.createdAt,
				updatedAt: aiChatConversation.updatedAt,
				recording: {
					id: consultationRecording.id,
					title: consultationRecording.title,
					transcript: consultationRecording.transcript,
				},
			})
			.from(aiChatConversation)
			.leftJoin(
				consultationRecording,
				eq(aiChatConversation.recordingId, consultationRecording.id),
			)
			.where(
				and(
					eq(aiChatConversation.id, conversationId),
					eq(aiChatConversation.doctorId, profile.id),
				),
			);

		if (!conversation) return apiError("CONVERSATION_NOT_FOUND");

		const messages = await db
			.select()
			.from(aiChatMessage)
			.where(eq(aiChatMessage.conversationId, conversationId))
			.orderBy(asc(aiChatMessage.createdAt));

		return json({
			...conversation,
			recording: conversation.recording?.id ? conversation.recording : null,
			messages,
		});
	} catch (e) {
		if (e instanceof Response) return e;
		return apiError("INTERNAL_ERROR");
	}
}

// ─── PATCH /api/ai-chat/conversations/[id] ────────────────────────────────────

const patchSchema = z
	.object({
		title: z.string().min(1).max(255).optional(),
		/** Pass `null` to unlink an imported recording from this conversation. */
		recordingId: z.number().int().positive().nullable().optional(),
	})
	.refine(
		(data) => data.title !== undefined || data.recordingId !== undefined,
		{ message: "Provide title and/or recordingId" },
	);

export async function PATCH(req: NextRequest, { params }: RouteContext) {
	try {
		const session = await requireSession();
		const profile = await requireDoctorProfile(session.user.id);

		const { id } = await params;
		const conversationId = Number(id);
		if (Number.isNaN(conversationId)) return apiError("INVALID_ID");

		const body = await req.json();
		const parsed = patchSchema.safeParse(body);
		if (!parsed.success) return validationError(parsed.error.issues);

		const updates: {
			title?: string;
			recordingId?: number | null;
			updatedAt: Date;
		} = { updatedAt: new Date() };
		if (parsed.data.title !== undefined) updates.title = parsed.data.title;
		if (parsed.data.recordingId !== undefined) {
			updates.recordingId = parsed.data.recordingId;
		}

		const [updated] = await db
			.update(aiChatConversation)
			.set(updates)
			.where(
				and(
					eq(aiChatConversation.id, conversationId),
					eq(aiChatConversation.doctorId, profile.id),
				),
			)
			.returning();

		if (!updated) return apiError("CONVERSATION_NOT_FOUND");
		return json(updated);
	} catch (e) {
		if (e instanceof Response) return e;
		return apiError("INTERNAL_ERROR");
	}
}

// ─── DELETE /api/ai-chat/conversations/[id] ───────────────────────────────────

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
	try {
		const session = await requireSession();
		const profile = await requireDoctorProfile(session.user.id);

		const { id } = await params;
		const conversationId = Number(id);
		if (Number.isNaN(conversationId)) return apiError("INVALID_ID");

		const [deleted] = await db
			.delete(aiChatConversation)
			.where(
				and(
					eq(aiChatConversation.id, conversationId),
					eq(aiChatConversation.doctorId, profile.id),
				),
			)
			.returning();

		if (!deleted) return apiError("CONVERSATION_NOT_FOUND");
		return json({ message: "Conversation deleted" });
	} catch (e) {
		if (e instanceof Response) return e;
		return apiError("INTERNAL_ERROR");
	}
}

import {
	selectAiChatConversationSchema,
	selectAiChatConversationWithMessagesSchema,
} from "@/db/zod";
import { registry } from "@/lib/openapi";

const paramsSchema = z.object({ id: z.string() });

registry.registerPath({
	method: "get",
	path: "/api/ai-chat/conversations/{id}",
	tags: ["AiChat"],
	summary: "Get AI chat conversation with messages",
	request: { params: paramsSchema },
	responses: {
		200: {
			description: "Conversation with messages",
			content: {
				"application/json": {
					schema: selectAiChatConversationWithMessagesSchema,
				},
			},
		},
	},
});

registry.registerPath({
	method: "patch",
	path: "/api/ai-chat/conversations/{id}",
	tags: ["AiChat"],
	summary: "Update AI chat conversation (title and/or recording link)",
	request: {
		params: paramsSchema,
		body: { content: { "application/json": { schema: patchSchema } } },
	},
	responses: {
		200: {
			description: "Updated conversation",
			content: {
				"application/json": { schema: selectAiChatConversationSchema },
			},
		},
	},
});

registry.registerPath({
	method: "delete",
	path: "/api/ai-chat/conversations/{id}",
	tags: ["AiChat"],
	summary: "Delete AI chat conversation",
	request: { params: paramsSchema },
	responses: {
		200: {
			description: "Deleted",
			content: {
				"application/json": {
					schema: z.object({ message: z.string() }),
				},
			},
		},
	},
});
