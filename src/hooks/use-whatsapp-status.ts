"use client";

import { usePractice } from "@/hooks/use-practice";
import { useGetApiWhatsappStatus } from "@/services/generated/whats-app/whats-app";

const REFRESH_MS = 30_000;

/**
 * Whether the practice's WhatsApp is linked. Messages go out from the doctor's
 * number, so a secretary sees the doctor's state. `notConnected` is only true
 * when the voice service says so; if it can't be reached the state is unknown
 * and nothing is blocked.
 */
export function useWhatsappStatus() {
	const { isSecretary, canWork } = usePractice();
	const { data } = useGetApiWhatsappStatus({
		swr: { enabled: canWork, refreshInterval: REFRESH_MS },
	});

	const notConnected = data?.connected === false;
	return {
		notConnected,
		notConnectedMessage: isSecretary
			? "WhatsApp is not connected. Ask the doctor to connect it."
			: "WhatsApp is not connected. Connect it from the WhatsApp page.",
	};
}
