import { and, eq, gte, lt, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { appointment, subscription, whatsappUsage } from "@/db/schema";
import { throwApiError } from "@/lib/errors";
import { getPlan, PLAN_IDS, type Plan, type PlanId } from "@/lib/plans";

export type UsagePeriod = {
	/** Inclusive start of the UTC calendar month */
	start: Date;
	/** Exclusive end of the UTC calendar month (= start of next month) */
	end: Date;
	/** e.g. "2026-09" */
	yyyyMm: string;
};

/** Current UTC calendar month bounds. */
export function getUtcCalendarMonthPeriod(now = new Date()): UsagePeriod {
	const start = new Date(
		Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0),
	);
	const end = new Date(
		Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0),
	);
	const yyyyMm = `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, "0")}`;
	return { start, end, yyyyMm };
}

export type EffectivePlan = {
	plan: Plan;
	planId: PlanId;
	/** True when Pro is active and within period */
	isPro: boolean;
};

/**
 * Resolve the doctor's effective plan for feature gating.
 * Missing / free / past_due / expired Pro → Free limits.
 */
export async function getEffectivePlan(
	doctorId: number,
): Promise<EffectivePlan> {
	const [sub] = await db
		.select()
		.from(subscription)
		.where(eq(subscription.doctorId, doctorId));

	const now = new Date();
	const isPro =
		!!sub &&
		sub.planId === "pro" &&
		sub.status === "active" &&
		(!sub.currentPeriodEnd || sub.currentPeriodEnd > now);

	const planId: PlanId =
		isPro && PLAN_IDS.includes(sub.planId as PlanId)
			? (sub.planId as PlanId)
			: "free";

	return { plan: getPlan(planId), planId, isPro };
}

/** Distinct AI-booked phones for this doctor in the current UTC calendar month. */
export async function countAiBookingPatientsThisMonth(
	doctorId: number,
	period = getUtcCalendarMonthPeriod(),
): Promise<number> {
	const [row] = await db
		.select({
			count: sql<number>`count(distinct ${appointment.newPatientPhoneNumber})`,
		})
		.from(appointment)
		.where(
			and(
				eq(appointment.doctorId, doctorId),
				eq(appointment.source, "ai"),
				gte(appointment.createdAt, period.start),
				lt(appointment.createdAt, period.end),
				ne(appointment.newPatientPhoneNumber, ""),
				sql`${appointment.newPatientPhoneNumber} is not null`,
			),
		);

	return Number(row?.count ?? 0);
}

export async function assertAiBookingAllowed(
	doctorId: number,
	phoneNumber: string,
): Promise<void> {
	const { plan } = await getEffectivePlan(doctorId);
	const limit = plan.limits.aiBookingPatients;
	if (limit == null) return;

	const phone = phoneNumber.replace(/\D/g, "");
	const period = getUtcCalendarMonthPeriod();

	// Already booked this phone via AI this month → allowed
	const [existing] = await db
		.select({ id: appointment.id })
		.from(appointment)
		.where(
			and(
				eq(appointment.doctorId, doctorId),
				eq(appointment.source, "ai"),
				eq(appointment.newPatientPhoneNumber, phone),
				gte(appointment.createdAt, period.start),
				lt(appointment.createdAt, period.end),
			),
		)
		.limit(1);

	if (existing) return;

	const used = await countAiBookingPatientsThisMonth(doctorId, period);
	if (used >= limit) {
		throwApiError("AI_BOOKING_LIMIT_REACHED");
	}
}

export async function getWhatsappSendsThisMonth(
	doctorId: number,
	period = getUtcCalendarMonthPeriod(),
): Promise<number> {
	const [row] = await db
		.select({ sendCount: whatsappUsage.sendCount })
		.from(whatsappUsage)
		.where(
			and(
				eq(whatsappUsage.doctorId, doctorId),
				eq(whatsappUsage.periodYyyyMm, period.yyyyMm),
			),
		);

	return row?.sendCount ?? 0;
}

/**
 * Atomically consume WhatsApp send quota for the current UTC month.
 * `count` is the number of messages/documents about to be sent.
 */
export async function assertAndRecordWhatsappSend(
	doctorId: number,
	count = 1,
): Promise<void> {
	if (count < 1) return;

	const { plan } = await getEffectivePlan(doctorId);
	const limit = plan.limits.whatsappSendsPerMonth;
	const period = getUtcCalendarMonthPeriod();
	const now = new Date();

	if (limit == null) {
		// Unlimited — still track usage for display
		await db
			.insert(whatsappUsage)
			.values({
				doctorId,
				periodYyyyMm: period.yyyyMm,
				sendCount: count,
				updatedAt: now,
			})
			.onConflictDoUpdate({
				target: [whatsappUsage.doctorId, whatsappUsage.periodYyyyMm],
				set: {
					sendCount: sql`${whatsappUsage.sendCount} + ${count}`,
					updatedAt: now,
				},
			});
		return;
	}

	// Ensure row exists
	await db
		.insert(whatsappUsage)
		.values({
			doctorId,
			periodYyyyMm: period.yyyyMm,
			sendCount: 0,
			updatedAt: now,
		})
		.onConflictDoNothing({
			target: [whatsappUsage.doctorId, whatsappUsage.periodYyyyMm],
		});

	const updated = await db
		.update(whatsappUsage)
		.set({
			sendCount: sql`${whatsappUsage.sendCount} + ${count}`,
			updatedAt: now,
		})
		.where(
			and(
				eq(whatsappUsage.doctorId, doctorId),
				eq(whatsappUsage.periodYyyyMm, period.yyyyMm),
				sql`${whatsappUsage.sendCount} + ${count} <= ${limit}`,
			),
		)
		.returning({ sendCount: whatsappUsage.sendCount });

	if (updated.length === 0) {
		throwApiError("WHATSAPP_LIMIT_REACHED");
	}
}

export async function getPlanUsage(doctorId: number) {
	const period = getUtcCalendarMonthPeriod();
	const { plan, planId, isPro } = await getEffectivePlan(doctorId);
	const [aiBookingPatients, whatsappSendsThisMonth] = await Promise.all([
		countAiBookingPatientsThisMonth(doctorId, period),
		getWhatsappSendsThisMonth(doctorId, period),
	]);

	return {
		plan,
		planId,
		isPro,
		limits: plan.limits,
		usage: {
			aiBookingPatients,
			whatsappSendsThisMonth,
		},
		usagePeriod: {
			start: period.start.toISOString(),
			end: period.end.toISOString(),
			yyyyMm: period.yyyyMm,
		},
	};
}
