import { and, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import {
	aiChatConversation,
	aiChatMessage,
	liveAiChatMessageStatuses,
} from "@/db/schema";
import {
	type AiActionPart,
	actionToolSchemas,
	aiActionOutcomeSchema,
	aiActionPartSchema,
} from "@/lib/ai-chat-parts";
import {
	apiError,
	json,
	requireDoctorProfile,
	requireSession,
	validationError,
} from "@/lib/api-utils";
import { registry } from "@/lib/openapi";

type RouteContext = { params: Promise<{ id: string; partId: string }> };

// ─── PATCH /api/ai-chat/messages/[id]/parts/[partId] ──────────────────────────
// Records what the doctor did with an action the assistant proposed. The
// action itself runs through its normal route (e.g. POST /api/invoices) from
// the card; this only saves the outcome, so the next question's history tells
// the model what really happened.

const patchSchema = z.discriminatedUnion("status", [
	z.object({
		status: z.literal("confirmed"),
		/** The values the doctor confirmed, after any edits on the card. */
		proposal: z
			.union([
				actionToolSchemas.propose_invoice.proposal,
				actionToolSchemas.propose_booking_decision.proposal,
				actionToolSchemas.propose_medical_note.proposal,
				actionToolSchemas.propose_appointment.proposal,
				actionToolSchemas.propose_reschedule.proposal,
			])
			.optional(),
		outcome: aiActionOutcomeSchema,
	}),
	z.object({ status: z.literal("dismissed") }),
	z.object({ status: z.literal("failed"), error: z.string().min(1) }),
]);

export async function PATCH(req: NextRequest, { params }: RouteContext) {
	try {
		const session = await requireSession();
		const profile = await requireDoctorProfile(session.user.id);

		const { id, partId } = await params;
		const messageId = Number(id);
		if (Number.isNaN(messageId)) return apiError("INVALID_ID");

		const parsed = patchSchema.safeParse(await req.json());
		if (!parsed.success) return validationError(parsed.error.issues);
		const body = parsed.data;

		const result = await db.transaction(async (tx) => {
			const [row] = await tx
				.select({ status: aiChatMessage.status, parts: aiChatMessage.parts })
				.from(aiChatMessage)
				.innerJoin(
					aiChatConversation,
					eq(aiChatConversation.id, aiChatMessage.conversationId),
				)
				.where(
					and(
						eq(aiChatMessage.id, messageId),
						eq(aiChatConversation.doctorId, profile.id),
					),
				)
				.for("update", { of: aiChatMessage });
			if (!row)
				return { ok: false as const, error: "AI_ACTION_NOT_FOUND" as const };
			// The reply's generator still owns the parts until it finishes
			if (liveAiChatMessageStatuses.includes(row.status)) {
				return { ok: false as const, error: "AI_REPLY_IN_PROGRESS" as const };
			}

			const index = row.parts.findIndex(
				(p) => p.type === "action" && p.id === partId,
			);
			const part = row.parts[index] as AiActionPart | undefined;
			if (!part)
				return { ok: false as const, error: "AI_ACTION_NOT_FOUND" as const };
			if (part.status !== "proposed") {
				return {
					ok: false as const,
					error: "AI_ACTION_ALREADY_DECIDED" as const,
				};
			}

			let updated: AiActionPart;
			if (body.status === "confirmed") {
				const proposal =
					body.proposal === undefined
						? part.proposal
						: actionToolSchemas[part.name].proposal.parse(body.proposal);
				updated = aiActionPartSchema.parse({
					...part,
					status: "confirmed",
					proposal,
					outcome: body.outcome,
				});
			} else if (body.status === "failed") {
				updated = { ...part, status: "failed", error: body.error };
			} else {
				updated = { ...part, status: "dismissed" };
			}

			const parts = row.parts.with(index, updated);
			await tx
				.update(aiChatMessage)
				.set({ parts })
				.where(eq(aiChatMessage.id, messageId));
			return { ok: true as const, part: updated };
		});

		if (!result.ok) return apiError(result.error);
		return json(result.part);
	} catch (e) {
		if (e instanceof Response) return e;
		if (e instanceof z.ZodError) return validationError(e.issues);
		return apiError("INTERNAL_ERROR");
	}
}

registry.registerPath({
	method: "patch",
	path: "/api/ai-chat/messages/{id}/parts/{partId}",
	tags: ["AiChat"],
	summary: "Record the doctor's decision on an action the assistant proposed",
	request: {
		params: z.object({ id: z.string(), partId: z.string() }),
		body: { content: { "application/json": { schema: patchSchema } } },
	},
	responses: {
		200: {
			description: "The updated action part",
			content: { "application/json": { schema: aiActionPartSchema } },
		},
	},
});
