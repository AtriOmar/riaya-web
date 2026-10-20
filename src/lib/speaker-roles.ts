import { z } from "zod";

/** Who a transcript speaker is. Worked out by the AI, correctable by the doctor. */
export const SPEAKER_ROLES = ["doctor", "patient", "companion"] as const;

export type SpeakerRole = (typeof SPEAKER_ROLES)[number];

export const SPEAKER_ROLE_LABELS: Record<SpeakerRole, string> = {
	doctor: "Doctor",
	patient: "Patient",
	companion: "Companion",
};

/** Transcript speaker label ("Speaker 1") → role. */
export const speakerRolesSchema = z.record(z.string(), z.enum(SPEAKER_ROLES));

export type SpeakerRoles = z.infer<typeof speakerRolesSchema>;
