import type { PostApiUploadSignedUrlBodyFolder } from "@/services/generated/api.schemas";
import { postApiUploadSignedUrl } from "@/services/generated/miscellaneous/miscellaneous";

/**
 * Upload a file to R2 via a presigned URL.
 * Returns the public CDN URL of the uploaded file.
 */
export async function uploadToR2(
	file: File,
	folder: PostApiUploadSignedUrlBodyFolder,
): Promise<string> {
	const { signedUrl, cdnUrl } = await postApiUploadSignedUrl({
		filename: file.name,
		contentType: file.type,
		folder,
	});

	const res = await fetch(signedUrl, {
		method: "PUT",
		body: file,
		headers: { "Content-Type": file.type },
	});
	if (!res.ok) throw new Error(`Upload failed (${res.status})`);

	return cdnUrl;
}

/**
 * Upload a Blob (e.g. cropped image) to R2.
 */
export async function uploadBlobToR2(
	blob: Blob,
	filename: string,
	folder: PostApiUploadSignedUrlBodyFolder,
): Promise<string> {
	const file = new File([blob], filename, { type: blob.type });
	return uploadToR2(file, folder);
}
