// Next.js Instrumentation — runs once when the server starts.
// https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation

export async function register() {
	// Only seed cron jobs in Node.js runtime (not edge), and not during builds.
	if (
		process.env.NEXT_RUNTIME === "nodejs" &&
		process.env.NEXT_PHASE !== "phase-production-build"
	) {
		const { seedSubscriptionCron } = await import("@/lib/queue");
		await seedSubscriptionCron().catch((err) => {
			console.error("[instrumentation] Failed to seed subscription cron:", err);
		});
	}
}
