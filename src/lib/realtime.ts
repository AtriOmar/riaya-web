import axios from "axios";
import { keyFromUrl, signedUrlForStoredFile } from "@/lib/r2";

/** HTTP base URL for the voice/realtime service (WhatsApp send, etc.). */
export function getRealtimeHttpUrl(): string | null {
	const url = process.env.NEXT_PUBLIC_REALTIME_URL?.trim();
	if (!url) return null;
	return url.replace(/^ws/, "http").replace(/\/$/, "");
}

/** Headers for server-to-server calls to the voice service. */
export function realtimeAuthHeaders(): Record<string, string> {
	return { "x-internal-secret": process.env.INTERNAL_API_SECRET ?? "" };
}

type WhatsappSend = {
	userId?: string;
	phone: string;
	message?: string;
	documentUrl?: string;
	fileName?: string;
	mimetype?: string;
};

/**
 * Asks the voice service to send a WhatsApp message from a doctor's number.
 * A stored file is passed as a short-lived signed link, since the voice
 * service has no access to the private bucket.
 */
export async function sendWhatsapp(httpUrl: string, body: WhatsappSend) {
	const documentUrl =
		body.documentUrl && keyFromUrl(body.documentUrl)
			? await signedUrlForStoredFile(body.documentUrl)
			: body.documentUrl;
	return axios.post(
		`${httpUrl}/send-whatsapp`,
		{ ...body, documentUrl },
		{ headers: realtimeAuthHeaders() },
	);
}
