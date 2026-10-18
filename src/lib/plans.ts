export const PLAN_IDS = ["free", "pro"] as const;

export type PlanId = (typeof PLAN_IDS)[number];

/** `null` means unlimited — used for enforcement, not marketing copy */
export type PlanLimits = {
	/** WhatsApp sends the doctor starts (invoices, medical files). Automatic patient messages are never counted. */
	whatsappSendsPerMonth: number | null;
	/** Transcribed recording time included each month. Purchased packs add on top. */
	recordingHoursPerMonth: number;
	aiMessagesPerMonth: number | null;
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
			aiMessagesPerMonth: 20,
		},
		canBuyRecordingPacks: false,
		canBrandDocuments: false,
		features: [
			"Patient records & appointments",
			"Availability & calendar",
			"Invoices & PDF download",
			"Medical files",
			"Unlimited AI phone booking",
			"30 WhatsApp sends / month",
			"2 hours of recording / month",
			"20 AI assistant messages / month",
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
			aiMessagesPerMonth: null,
		},
		canBuyRecordingPacks: true,
		canBrandDocuments: true,
		features: [
			"Everything in Free",
			"Unlimited WhatsApp sends",
			"100 hours of recording / month",
			"Add more recording hours anytime",
			"Unlimited AI assistant messages",
			"Your logo & stamp on invoices",
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
