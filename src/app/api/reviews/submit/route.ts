import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { review } from "@/db/schema";
import { apiError, json, validationError } from "@/lib/api-utils";
import { registry } from "@/lib/openapi";

const submitReviewSchema = z.object({
	token: z.string().uuid(),
	rating: z.number().int().min(1).max(5),
	waitTime: z.enum(["short", "medium", "long"]),
	comment: z.string().optional(),
});

export async function POST(req: NextRequest) {
	try {
		const body = await req.json();
		const parsed = submitReviewSchema.safeParse(body);

		if (!parsed.success) return validationError(parsed.error.issues);

		const { token, rating, waitTime, comment } = parsed.data;

		// 1. Fetch the review by token
		const existingReview = await db.query.review.findFirst({
			where: eq(review.token, token),
		});

		if (!existingReview) {
			return apiError("REVIEW_NOT_FOUND", {
				message: "Review request not found or invalid link.",
			});
		}

		if (existingReview.status === "submitted") {
			return apiError("REVIEW_ALREADY_SUBMITTED", {
				message: "This review has already been submitted.",
			});
		}

		// 2. Update the review
		await db
			.update(review)
			.set({
				rating,
				waitTime,
				comment,
				status: "submitted",
				updatedAt: new Date(),
			})
			.where(eq(review.id, existingReview.id));

		return json({ success: true });
	} catch (e) {
		if (e instanceof Response) return e;
		console.error("Failed to submit review:", e);
		return apiError("INTERNAL_ERROR");
	}
}

registry.registerPath({
	method: "post",
	path: "/api/reviews/submit",
	tags: ["Reviews"],
	summary: "Submit a review via magic link",
	request: {
		body: {
			content: {
				"application/json": {
					schema: submitReviewSchema,
				},
			},
		},
	},
	responses: {
		200: {
			description: "Review submitted successfully",
			content: {
				"application/json": {
					schema: z.object({ success: z.boolean() }),
				},
			},
		},
	},
});
