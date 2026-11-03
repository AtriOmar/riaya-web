import { eq } from "drizzle-orm";
import { db } from "@/db";
import { platformSettings } from "@/db/schema";
import {
	DEFAULT_PLATFORM_SETTINGS,
	type PlatformSettingsInput,
} from "@/lib/platform-settings-schema";

const SETTINGS_ROW_ID = 1;

export async function getPlatformSettings(): Promise<PlatformSettingsInput> {
	const [row] = await db
		.select({
			pendingTimeoutMinutes: platformSettings.pendingTimeoutMinutes,
			emergencyWaveTimeoutMinutes: platformSettings.emergencyWaveTimeoutMinutes,
			emergencyFanoutCount: platformSettings.emergencyFanoutCount,
			emergencyMaxWaves: platformSettings.emergencyMaxWaves,
		})
		.from(platformSettings)
		.where(eq(platformSettings.id, SETTINGS_ROW_ID));
	return row ?? DEFAULT_PLATFORM_SETTINGS;
}

export async function savePlatformSettings(
	input: PlatformSettingsInput,
	updatedBy: string,
) {
	const values = { ...input, updatedBy, updatedAt: new Date() };
	const [row] = await db
		.insert(platformSettings)
		.values({ id: SETTINGS_ROW_ID, ...values })
		.onConflictDoUpdate({ target: platformSettings.id, set: values })
		.returning();
	return row;
}
