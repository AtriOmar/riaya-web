import { z } from "zod";

/** Allowed range in minutes; matches the check constraints on the table. */
export const PENDING_TIMEOUT_RANGE = { min: 1, max: 120 } as const;
export const EMERGENCY_WAVE_TIMEOUT_RANGE = { min: 1, max: 30 } as const;

export const EMERGENCY_FANOUT_RANGE = { min: 1, max: 10 } as const;
export const EMERGENCY_MAX_WAVES_RANGE = { min: 1, max: 10 } as const;

export const platformSettingsInputSchema = z.object({
	pendingTimeoutMinutes: z
		.number()
		.int()
		.min(PENDING_TIMEOUT_RANGE.min)
		.max(PENDING_TIMEOUT_RANGE.max),
	emergencyWaveTimeoutMinutes: z
		.number()
		.int()
		.min(EMERGENCY_WAVE_TIMEOUT_RANGE.min)
		.max(EMERGENCY_WAVE_TIMEOUT_RANGE.max),
	emergencyFanoutCount: z
		.number()
		.int()
		.min(EMERGENCY_FANOUT_RANGE.min)
		.max(EMERGENCY_FANOUT_RANGE.max),
	emergencyMaxWaves: z
		.number()
		.int()
		.min(EMERGENCY_MAX_WAVES_RANGE.min)
		.max(EMERGENCY_MAX_WAVES_RANGE.max),
});

export type PlatformSettingsInput = z.infer<typeof platformSettingsInputSchema>;

/** What the platform uses until an admin saves the settings for the first time. */
export const DEFAULT_PLATFORM_SETTINGS: PlatformSettingsInput = {
	pendingTimeoutMinutes: 10,
	emergencyWaveTimeoutMinutes: 4,
	emergencyFanoutCount: 3,
	emergencyMaxWaves: 3,
};
