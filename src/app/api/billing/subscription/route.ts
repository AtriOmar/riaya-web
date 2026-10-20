// GET /api/billing/subscription — get (or lazily create) the doctor's subscription
// plus effective plan limits and calendar-month usage.

import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { subscription } from "@/db/schema";
import { json, requireDoctorProfile, requireSession } from "@/lib/api-utils";
import { apiError } from "@/lib/errors";
import { getPlanUsage } from "@/lib/plan-limits";

export async function GET() {
	try {
		const session = await requireSession();
		const profile = await requireDoctorProfile(session.user.id);

		let [sub] = await db
			.select()
			.from(subscription)
			.where(eq(subscription.doctorId, profile.id));

		// Lazily provision a free subscription on first access
		if (!sub) {
			[sub] = await db
				.insert(subscription)
				.values({ doctorId: profile.id, planId: "free", status: "active" })
				.returning();
		}

		return json({ subscription: sub, plan: await getPlanUsage(profile.id) });
	} catch (err) {
		if (err instanceof Response) return err;
		console.error("[billing/subscription GET]", err);
		return apiError("INTERNAL_ERROR");
	}
}

import { planUsageSchema, selectSubscriptionSchema } from "@/db/zod";
import { registry } from "@/lib/openapi";

registry.registerPath({
	method: "get",
	path: "/api/billing/subscription",
	tags: ["Billing"],
	summary: "Get the doctor's subscription and plan usage",
	responses: {
		200: {
			description: "Subscription row and effective plan usage",
			content: {
				"application/json": {
					schema: z.object({
						subscription: selectSubscriptionSchema,
						plan: planUsageSchema,
					}),
				},
			},
		},
	},
});
