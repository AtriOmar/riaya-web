import { getEffectivePlan } from "@/lib/plan-limits";

/** Logo and stamp printed on a doctor's invoices. `null` = Riaya footer (Free). */
export type DocumentBranding = {
	logo: Buffer | null;
	stamp: Buffer | null;
};

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 5000;

/** Only our own CDN — the PDF builder fetches these server-side. */
export function isCdnUrl(url: string): boolean {
	const cdn = process.env.CDN_URL?.replace(/\/$/, "");
	return !!cdn && url.startsWith(`${cdn}/`);
}

/** pdfkit only embeds PNG and JPEG; check the bytes, not the extension. */
function isPngOrJpeg(bytes: Buffer): boolean {
	const png =
		bytes.length > 8 &&
		bytes[0] === 0x89 &&
		bytes[1] === 0x50 &&
		bytes[2] === 0x4e &&
		bytes[3] === 0x47;
	const jpeg = bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8;
	return png || jpeg;
}

/** Downloads an image for the PDF. A missing or broken image is skipped, never fatal. */
async function loadImage(url: string | null): Promise<Buffer | null> {
	if (!url || !isCdnUrl(url)) return null;
	try {
		const res = await fetch(url, {
			signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
		});
		if (!res.ok) return null;
		const bytes = Buffer.from(await res.arrayBuffer());
		if (bytes.length > MAX_IMAGE_BYTES || !isPngOrJpeg(bytes)) return null;
		return bytes;
	} catch (err) {
		console.error("Document branding image failed to load:", url, err);
		return null;
	}
}

/**
 * The doctor's branding for documents, or `null` when their plan doesn't
 * include it (the document then carries the Riaya footer).
 */
export async function loadDocumentBranding(doctor: {
	id: number;
	logoUrl: string | null;
	stampUrl: string | null;
}): Promise<DocumentBranding | null> {
	const { plan } = await getEffectivePlan(doctor.id);
	if (!plan.canBrandDocuments) return null;

	const [logo, stamp] = await Promise.all([
		loadImage(doctor.logoUrl),
		loadImage(doctor.stampUrl),
	]);
	return { logo, stamp };
}
