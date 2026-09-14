export const PLAN_IDS = ["free", "pro"] as const;

export type PlanId = (typeof PLAN_IDS)[number];

/** `null` means unlimited — used for enforcement, not marketing copy */
export type PlanLimits = {
	aiBookingPatients: number | null;
	whatsappSendsPerMonth: number | null;
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
			aiBookingPatients: 5,
			whatsappSendsPerMonth: 50,
		},
		features: [
			"Patient records & appointments",
			"Availability & calendar",
			"Invoices & PDF download",
			"Medical files",
			"AI phone booking for up to 5 patients / month",
			"50 WhatsApp sends / month",
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
			aiBookingPatients: null,
			whatsappSendsPerMonth: null,
		},
		features: [
			"Everything in Free",
			"Unlimited AI phone booking",
			"Unlimited WhatsApp sends",
			"Priority support",
		],
	},
};

export const PLAN_LIST = PLAN_IDS.map((id) => PLANS[id]);

export function getPlan(id: PlanId): Plan {
	return PLANS[id];
}
