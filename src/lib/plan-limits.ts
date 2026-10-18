import { and, eq, gte, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import {
	aiChatConversation,
	aiChatMessage,
	billingInvoice,
	recordingUsage,
	subscription,
	whatsappUsage,
} from "@/db/schema";
import { throwApiError } from "@/lib/errors";
import { getPlan, type Plan, type PlanId } from "@/lib/plans";

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
 * The plan a doctor is effectively on, from their subscription row.
 * Missing / free / past_due / expired Pro → "free".
 */
export function resolvePlanId(
	sub: Pick<
		typeof subscription.$inferSelect,
		"planId" | "status" | "currentPeriodEnd"
	> | null,
	now = new Date(),
): PlanId {
	const isPro =
		!!sub &&
		sub.planId === "pro" &&
		sub.status === "active" &&
		(!sub.currentPeriodEnd || sub.currentPeriodEnd > now);

	return isPro ? "pro" : "free";
}

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

	const planId = resolvePlanId(sub ?? null);

	return { plan: getPlan(planId), planId, isPro: planId === "pro" };
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

// ─── Recording time ───────────────────────────────────────────────────────────
// Each transcribed recording uses its audio length. The plan's monthly hours
// cover it first; anything beyond comes out of purchased pack hours (no expiry).

/** Advisory-lock namespace serialising recording charges per doctor. */
const RECORDING_CHARGE_LOCK = 7301;

type Reader = Pick<typeof db, "select">;

async function getRecordingSecondsUsed(
	reader: Reader,
	doctorId: number,
	period: UsagePeriod,
): Promise<number> {
	const [row] = await reader
		.select({
			seconds: sql<string>`coalesce(sum(${recordingUsage.seconds}), 0)`,
		})
		.from(recordingUsage)
		.where(
			and(
				eq(recordingUsage.doctorId, doctorId),
				gte(recordingUsage.createdAt, period.start),
				lt(recordingUsage.createdAt, period.end),
			),
		);
	return Number(row?.seconds ?? 0);
}

/** Purchased pack time not yet used. */
async function getRecordingCreditSeconds(
	reader: Reader,
	doctorId: number,
): Promise<number> {
	const [[bought], [spent]] = await Promise.all([
		reader
			.select({
				seconds: sql<string>`coalesce(sum(${billingInvoice.creditSeconds}), 0)`,
			})
			.from(billingInvoice)
			.where(
				and(
					eq(billingInvoice.doctorId, doctorId),
					eq(billingInvoice.kind, "top_up"),
					eq(billingInvoice.status, "paid"),
				),
			),
		reader
			.select({
				seconds: sql<string>`coalesce(sum(${recordingUsage.creditSeconds}), 0)`,
			})
			.from(recordingUsage)
			.where(eq(recordingUsage.doctorId, doctorId)),
	]);
	return Math.max(
		0,
		Number(bought?.seconds ?? 0) - Number(spent?.seconds ?? 0),
	);
}

export type RecordingTime = {
	/** Included in the plan this month */
	includedSeconds: number;
	/** Used this month (included + pack time) */
	usedSeconds: number;
	/** Purchased pack time left */
	extraSeconds: number;
	/** What can still be recorded: included time left + pack time left */
	remainingSeconds: number;
};

export async function getRecordingTime(
	doctorId: number,
	plan?: Plan,
	period = getUtcCalendarMonthPeriod(),
): Promise<RecordingTime> {
	const effectivePlan = plan ?? (await getEffectivePlan(doctorId)).plan;
	const includedSeconds = effectivePlan.limits.recordingHoursPerMonth * 3600;
	const [usedSeconds, extraSeconds] = await Promise.all([
		getRecordingSecondsUsed(db, doctorId, period),
		getRecordingCreditSeconds(db, doctorId),
	]);
	return {
		includedSeconds,
		usedSeconds,
		extraSeconds,
		remainingSeconds: Math.max(0, includedSeconds - usedSeconds) + extraSeconds,
	};
}

/** Blocks a new recording once the month's hours and pack hours are used up. */
export async function assertRecordingAllowed(doctorId: number): Promise<void> {
	const { remainingSeconds } = await getRecordingTime(doctorId);
	if (remainingSeconds <= 0) {
		throwApiError("RECORDING_LIMIT_REACHED");
	}
}

/**
 * Records the audio time a transcribed recording used. Once per recording.
 * The part beyond the month's included hours is paid from pack hours (as far
 * as they go — a recording that overruns the last minutes is not cut off).
 */
export async function chargeRecordingUsage(
	doctorId: number,
	recordingId: number,
	seconds: number,
): Promise<void> {
	if (seconds <= 0) return;
	const { plan } = await getEffectivePlan(doctorId);
	const includedSeconds = plan.limits.recordingHoursPerMonth * 3600;
	const period = getUtcCalendarMonthPeriod();

	await db.transaction(async (tx) => {
		await tx.execute(
			sql`select pg_advisory_xact_lock(${RECORDING_CHARGE_LOCK}, ${doctorId})`,
		);

		const [existing] = await tx
			.select({ id: recordingUsage.id })
			.from(recordingUsage)
			.where(eq(recordingUsage.recordingId, recordingId));
		if (existing) return;

		const used = await getRecordingSecondsUsed(tx, doctorId, period);
		const beyondIncluded =
			Math.max(0, used + seconds - includedSeconds) -
			Math.max(0, used - includedSeconds);
		const credit = await getRecordingCreditSeconds(tx, doctorId);

		await tx.insert(recordingUsage).values({
			doctorId,
			recordingId,
			seconds,
			creditSeconds: Math.min(beyondIncluded, credit),
		});
	});
}
// ─── AI assistant ─────────────────────────────────────────────────────────────
// Measured in real model cost (OpenRouter bills each reply), so long chats with
// a transcript count for more than quick questions.

/** Model cost of the doctor's AI replies this UTC month, in millionths of a USD. */
export async function getAiCostThisMonth(
	doctorId: number,
	period = getUtcCalendarMonthPeriod(),
): Promise<number> {
	const [row] = await db
		.select({
			micros: sql<string>`coalesce(sum(${aiChatMessage.costMicroUsd}), 0)`,
		})
		.from(aiChatMessage)
		.innerJoin(
			aiChatConversation,
			eq(aiChatMessage.conversationId, aiChatConversation.id),
		)
		.where(
			and(
				eq(aiChatConversation.doctorId, doctorId),
				eq(aiChatMessage.role, "assistant"),
				gte(aiChatMessage.createdAt, period.start),
				lt(aiChatMessage.createdAt, period.end),
			),
		);

	return Number(row?.micros ?? 0);
}

/** Share of the month's AI budget used, 0–100. */
function aiPercentUsed(costMicros: number, budgetMicros: number): number {
	if (budgetMicros <= 0) return 100;
	return Math.min(100, Math.round((costMicros / budgetMicros) * 100));
}

/**
 * Blocks a new question once the month's AI budget is spent. A reply's cost
 * is only known afterwards, so the last one may go slightly over.
 */
export async function assertAiAllowed(doctorId: number): Promise<void> {
	const { plan } = await getEffectivePlan(doctorId);
	const used = await getAiCostThisMonth(doctorId);
	if (used >= plan.limits.aiBudgetMicroUsdPerMonth) {
		throwApiError("AI_USAGE_LIMIT_REACHED");
	}
}

/** Matches `planUsageSchema` in `db/zod.ts`. */
export async function getPlanUsage(doctorId: number) {
	const period = getUtcCalendarMonthPeriod();
	const { plan, planId, isPro } = await getEffectivePlan(doctorId);
	const [whatsappSendsThisMonth, aiCostMicros, recordingTime] =
		await Promise.all([
			getWhatsappSendsThisMonth(doctorId, period),
			getAiCostThisMonth(doctorId, period),
			getRecordingTime(doctorId, plan, period),
		]);
	const aiBudget = plan.limits.aiBudgetMicroUsdPerMonth;

	return {
		planId,
		isPro,
		// The AI budget stays server-side; doctors see a percentage
		limits: {
			whatsappSendsPerMonth: plan.limits.whatsappSendsPerMonth,
			recordingHoursPerMonth: plan.limits.recordingHoursPerMonth,
		},
		canBuyRecordingPacks: plan.canBuyRecordingPacks,
		canBrandDocuments: plan.canBrandDocuments,
		usage: {
			whatsappSendsThisMonth,
			aiPercentUsed: aiPercentUsed(aiCostMicros, aiBudget),
		},
		recordingTime,
		usagePeriod: {
			start: period.start.toISOString(),
			end: period.end.toISOString(),
			yyyyMm: period.yyyyMm,
		},
	};
}
