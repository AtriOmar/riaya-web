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
