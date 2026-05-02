import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
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
 * Upload a buffer directly to R2 from the server. Returns the public CDN URL.
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
