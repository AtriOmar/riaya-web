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
