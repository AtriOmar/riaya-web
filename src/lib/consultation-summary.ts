import { z } from "zod";

/** Structured note the AI writes from a consultation transcript (Pro). */
export const consultationSummarySchema = z.object({
	reason: z.string(),
	history: z.string(),
	examination: z.string(),
	assessment: z.string(),
	plan: z.string(),
});

export type ConsultationSummary = z.infer<typeof consultationSummarySchema>;

/** Sections in display order. Empty sections weren't discussed. */
export const CONSULTATION_SUMMARY_SECTIONS: {
	key: keyof ConsultationSummary;
	label: string;
}[] = [
	{ key: "reason", label: "Reason for visit" },
	{ key: "history", label: "History" },
	{ key: "examination", label: "Examination" },
	{ key: "assessment", label: "Assessment" },
	{ key: "plan", label: "Plan" },
];
