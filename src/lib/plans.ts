export const PLAN_IDS = ["free", "pro"] as const;

export type PlanId = (typeof PLAN_IDS)[number];

/** `null` means unlimited — used for enforcement, not marketing copy */
/**
 * What a typical AI assistant question costs (model cost, millionths of a USD).
 * Turns budgets into "about N questions". Set on the cautious side so most
 * doctors get more than we promise; update it from the logged costs
 * (`ai_chat_message.cost_micro_usd`).
 */
export const AI_TYPICAL_QUESTION_MICRO_USD = 2_500;

/** "About N questions" for an AI budget, rounded to a friendly number. */
export function approxAiQuestions(
	budgetMicroUsd: number,
	perQuestionMicroUsd = AI_TYPICAL_QUESTION_MICRO_USD,
): number {
	const n = budgetMicroUsd / Math.max(perQuestionMicroUsd, 1);
	const step = n >= 1000 ? 100 : n >= 100 ? 10 : 1;
	return Math.floor(n / step) * step;
}

// Monthly AI budgets (model cost, millionths of a USD). Placeholders until
// the logged costs show real use.
const FREE_AI_BUDGET_MICRO_USD = 50_000; // ≈ $0.05
const PRO_AI_BUDGET_MICRO_USD = 5_000_000; // ≈ $5 ≈ 15 TND

export type PlanLimits = {
	/** WhatsApp sends the doctor starts (invoices, medical files). Automatic patient messages are never counted. */
	whatsappSendsPerMonth: number | null;
	/** Transcribed recording time included each month. Purchased packs add on top. */
	recordingHoursPerMonth: number;
	/**
	 * AI assistant budget per month, in millionths of a USD of real model cost.
	 * Doctors see it as a percentage and as "about N questions".
	 */
	aiBudgetMicroUsdPerMonth: number;
};

export type Plan = {
	id: PlanId;
	name: string;
	description: string;
	/** Monthly price in TND. `0` = free. */
	priceTnd: number;
	popular: boolean;
	cta: string;
	limits: PlanLimits;
	/** Can buy recording time packs. */
	canBuyRecordingPacks: boolean;
	/** Invoices carry the doctor's logo and stamp instead of the Riaya footer. */
	canBrandDocuments: boolean;
	/** Can add secretary accounts (as many as they like). */
	canHaveSecretaries: boolean;
	/** Transcribed recordings get an AI consultation note (covered by recording hours). */
	canSummarizeRecordings: boolean;
	features: string[];
};

export const PLANS: Record<PlanId, Plan> = {
	free: {
		id: "free",
		name: "Free",
		description: "Run your practice and try Riaya",
		priceTnd: 0,
		popular: false,
		cta: "Get Started",
		limits: {
			whatsappSendsPerMonth: 30,
			recordingHoursPerMonth: 2,
			aiBudgetMicroUsdPerMonth: FREE_AI_BUDGET_MICRO_USD,
		},
		canBuyRecordingPacks: false,
		canBrandDocuments: false,
		canHaveSecretaries: false,
		canSummarizeRecordings: false,
		features: [
			"Patient records & appointments",
			"Availability & calendar",
			"Invoices & PDF download",
			"Medical files",
			"Unlimited AI phone booking",
			"30 WhatsApp sends / month",
			"2 hours of recording / month",
			`About ${approxAiQuestions(FREE_AI_BUDGET_MICRO_USD)} AI assistant questions / month`,
		],
	},
	pro: {
		id: "pro",
		name: "Pro",
		description: "Full AI receptionist for your practice",
		priceTnd: 49,
		popular: true,
		cta: "Start Pro",
		limits: {
			whatsappSendsPerMonth: null,
			recordingHoursPerMonth: 100,
			aiBudgetMicroUsdPerMonth: PRO_AI_BUDGET_MICRO_USD,
		},
		canBuyRecordingPacks: true,
		canBrandDocuments: true,
		canHaveSecretaries: true,
		canSummarizeRecordings: true,
		features: [
			"Everything in Free",
			"Unlimited WhatsApp sends",
			"100 hours of recording / month, transcribed & summarized",
			"Add more recording hours anytime",
			`About ${approxAiQuestions(PRO_AI_BUDGET_MICRO_USD).toLocaleString("en-US")} AI assistant questions / month`,
			"Your logo & stamp on invoices",
			"Secretary accounts",
			"Priority support",
		],
	},
};

export const PLAN_LIST = PLAN_IDS.map((id) => PLANS[id]);

export function getPlan(id: PlanId): Plan {
	return PLANS[id];
}

// ─── Recording time packs ─────────────────────────────────────────────────────
// One-time purchases on top of the monthly allowance. Hours never expire and
// are used only after the month's included hours run out.

export const RECORDING_PACK_IDS = ["hours_25", "hours_100"] as const;

export type RecordingPackId = (typeof RECORDING_PACK_IDS)[number];

export type RecordingPack = {
	id: RecordingPackId;
	hours: number;
	priceTnd: number;
};

export const RECORDING_PACKS: Record<RecordingPackId, RecordingPack> = {
	hours_25: { id: "hours_25", hours: 25, priceTnd: 15 },
	hours_100: { id: "hours_100", hours: 100, priceTnd: 50 },
};

export const RECORDING_PACK_LIST = RECORDING_PACK_IDS.map(
	(id) => RECORDING_PACKS[id],
);
