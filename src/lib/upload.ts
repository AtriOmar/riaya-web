import { getSignedUploadUrl, type UploadFolder } from "@/services/upload";

/**
 * Upload a file to R2 via a presigned URL.
 * Returns the public CDN URL of the uploaded file.
 */
export async function uploadToR2(
  file: File,
  folder: UploadFolder,
): Promise<string> {
  const { signedUrl, cdnUrl } = await getSignedUploadUrl(
    file.name,
    file.type,
    folder,
  );

  await fetch(signedUrl, {
    method: "PUT",
    body: file,
    headers: { "Content-Type": file.type },
  });

  return cdnUrl;
}

/**
 * Upload a Blob (e.g. cropped image) to R2.
 */
export async function uploadBlobToR2(
  blob: Blob,
  filename: string,
  folder: UploadFolder,
): Promise<string> {
  const file = new File([blob], filename, { type: blob.type });
  return uploadToR2(file, folder);
}
