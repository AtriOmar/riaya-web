import { Queue } from "bullmq";
import Redis from "ioredis";

// Use the REDIS_URL environment variable if provided, otherwise default to local development
const connection = new Redis(
	process.env.REDIS_URL || "redis://localhost:6379",
	{
		maxRetriesPerRequest: null,
		retryStrategy(times) {
			// Prevent endless retries during static generation/scripts
			if (process.env.NODE_ENV === "development") return null;
			return Math.min(times * 50, 2000);
		},
	},
);

export const reviewQueue = new Queue("review-queue", { connection });

// ─── Subscription queue ───────────────────────────────────────────────────────
// Processed by voice/src/workers/subscriptionWorker.ts
// A single repeatable job fires daily to check for subscriptions expiring soon.

export const subscriptionQueue = new Queue("subscription-queue", {
	connection,
});

/**
 * Seed the daily repeatable job if it's not already registered,
 * and also enqueue an immediate one-shot check on server start.
 * BullMQ v6 uses `upsertJobScheduler` for cron-based repeatable jobs.
 * Safe to call multiple times — upsertJobScheduler is idempotent.
 */
export async function seedSubscriptionCron() {
	await subscriptionQueue.upsertJobScheduler(
		"subscription-daily-check", // scheduler id — acts as dedup key
		{ pattern: "0 8 * * *" }, // every day at 08:00 UTC
		{ name: "check-expiring", data: {} },
	);

	// Run once as soon as the worker is available (e.g. after deploy / restart).
	// Idempotent on the API side, so duplicate runs from rapid restarts are fine.
	await subscriptionQueue.add(
		"check-expiring",
		{ reason: "startup" },
		{
			removeOnComplete: true,
			removeOnFail: true,
		},
	);
}
