import {
	DeleteObjectCommand,
	GetObjectCommand,
	PutObjectCommand,
	S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export const r2 = new S3Client({
	region: "auto",
	endpoint: process.env.R2_ENDPOINT ?? "",
	credentials: {
		accessKeyId: process.env.R2_ACCESS_KEY_ID ?? "",
		secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? "",
	},
});

export async function generateSignedUploadUrl(
	key: string,
	contentType: string,
) {
	const command = new PutObjectCommand({
		Bucket: process.env.R2_BUCKET_NAME ?? "",
		Key: key,
		ContentType: contentType,
	});
	const url = await getSignedUrl(r2, command, { expiresIn: 600 });
	return url;
}

/**
 * Upload a buffer directly to R2 from the server. Returns the stored file URL.
 */
export async function uploadBufferToR2(
	key: string,
	body: Buffer | Uint8Array,
	contentType: string,
): Promise<string> {
	await r2.send(
		new PutObjectCommand({
			Bucket: process.env.R2_BUCKET_NAME ?? "",
			Key: key,
			Body: body,
			ContentType: contentType,
		}),
	);
	const cdn = (process.env.CDN_URL ?? "").replace(/\/$/, "");
	return `${cdn}/${key}`;
}

/**
 * The bucket is private. Stored file URLs point at the web app's own
 * `/api/files/<key>` route (CDN_URL), which checks who is asking before it
 * redirects to a short-lived signed link. This returns the object key of such
 * a URL, or null for URLs outside our storage.
 */
export function keyFromUrl(url: string): string | null {
	const base = (process.env.CDN_URL ?? "").replace(/\/$/, "");
	if (!base || !url.startsWith(`${base}/`)) return null;
	return url.slice(base.length + 1).split("?")[0];
}

/** Short-lived signed download link for an object key. */
export function signedDownloadUrl(key: string, expiresIn = 60) {
	return getSignedUrl(
		r2,
		new GetObjectCommand({
			Bucket: process.env.R2_BUCKET_NAME ?? "",
			Key: key,
		}),
		{ expiresIn },
	);
}

/**
 * Server-side read of a stored file: signs the link and fetches it. For code
 * that has no browser session (PDF building, transcription, WhatsApp sends).
 */
export async function fetchStoredFile(
	url: string,
	init?: RequestInit,
): Promise<Response> {
	const key = keyFromUrl(url);
	if (!key) throw new Error("Not a stored file URL");
	return fetch(await signedDownloadUrl(key, 300), init);
}

/** A signed link another service (the voice server) can download from. */
export async function signedUrlForStoredFile(url: string): Promise<string> {
	const key = keyFromUrl(url);
	if (!key) throw new Error("Not a stored file URL");
	return signedDownloadUrl(key, 600);
}

/**
 * Deletes a file we uploaded, by its stored URL. URLs outside our storage are
 * ignored. Never throws: a leftover file is better than a failed delete.
 */
export async function deleteFromR2ByUrl(url: string): Promise<void> {
	const key = keyFromUrl(url);
	if (!key) return;
	try {
		await r2.send(
			new DeleteObjectCommand({
				Bucket: process.env.R2_BUCKET_NAME ?? "",
				Key: key,
			}),
		);
	} catch (err) {
		console.error("R2 delete failed:", url, err);
	}
}
