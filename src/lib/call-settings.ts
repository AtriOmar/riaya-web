import type { CallSettings } from "@/lib/call-settings-schema";
import { connection } from "@/lib/queue";

const KEY_PREFIX = "call-settings:";
const TTL_SECONDS = 60 * 60;

/** Store a test call's model choices for the voice server / agent to read. */
export async function saveCallSettings(
	callSid: string,
	settings: CallSettings,
): Promise<void> {
	await connection.set(
		`${KEY_PREFIX}${callSid}`,
		JSON.stringify(settings),
		"EX",
		TTL_SECONDS,
	);
}
