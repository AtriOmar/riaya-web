// GET /api/billing/subscription — get (or lazily create) the doctor's subscription
// plus effective plan limits and calendar-month usage.

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { subscription } from "@/db/schema";
import { getDoctorProfile, json, requireSession } from "@/lib/api-utils";
import { apiError } from "@/lib/errors";
import { getPlanUsage } from "@/lib/plan-limits";

export async function GET() {
	try {
		const session = await requireSession();
		const profile = await getDoctorProfile(session.user.id);
		if (!profile) return apiError("DOCTOR_PROFILE_NOT_FOUND");

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

		const usageInfo = await getPlanUsage(profile.id);

		return json({
			...sub,
			effectivePlanId: usageInfo.planId,
			isPro: usageInfo.isPro,
			limits: usageInfo.limits,
			usage: usageInfo.usage,
			usagePeriod: usageInfo.usagePeriod,
		});
	} catch (err) {
		if (err instanceof Response) return err;
		console.error("[billing/subscription GET]", err);
		return apiError("INTERNAL_ERROR");
	}
}
