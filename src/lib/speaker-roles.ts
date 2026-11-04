import { z } from "zod";

/** Who a transcript speaker is. Worked out by the AI, correctable by the doctor. */
export const SPEAKER_ROLES = ["doctor", "patient", "companion"] as const;

export type SpeakerRole = (typeof SPEAKER_ROLES)[number];

export const SPEAKER_ROLE_LABELS: Record<SpeakerRole, string> = {
	doctor: "Doctor",
	patient: "Patient",
	companion: "Companion",
};

/** Tailwind classes per role so speakers are told apart at a glance. */
export const SPEAKER_ROLE_COLORS: Record<
	SpeakerRole,
	{ text: string; dot: string; bg: string }
> = {
	doctor: {
		text: "text-green-700 dark:text-green-400",
		dot: "bg-green-500",
		bg: "bg-green-500/[0.08] hover:bg-green-500/[0.12]",
	},
	patient: {
		text: "text-amber-700 dark:text-amber-400",
		dot: "bg-amber-500",
		bg: "bg-amber-500/[0.08] hover:bg-amber-500/[0.12]",
	},
	companion: {
		text: "text-sky-700 dark:text-sky-400",
		dot: "bg-sky-500",
		bg: "bg-sky-500/[0.08] hover:bg-sky-500/[0.12]",
	},
};

/** Colors for speakers whose role isn't known yet, by order of appearance. */
export const UNASSIGNED_SPEAKER_COLORS = [
	{
		text: "text-slate-700 dark:text-slate-400",
		dot: "bg-slate-500",
		bg: "bg-slate-500/[0.08] hover:bg-slate-500/[0.12]",
	},
	{
		text: "text-cyan-700 dark:text-cyan-400",
		dot: "bg-cyan-500",
		bg: "bg-cyan-500/[0.08] hover:bg-cyan-500/[0.12]",
	},
	{
		text: "text-stone-700 dark:text-stone-400",
		dot: "bg-stone-500",
		bg: "bg-stone-500/[0.08] hover:bg-stone-500/[0.12]",
	},
];

/** Transcript speaker label ("Speaker 1") → role. */
export const speakerRolesSchema = z.record(z.string(), z.enum(SPEAKER_ROLES));

export type SpeakerRoles = z.infer<typeof speakerRolesSchema>;
