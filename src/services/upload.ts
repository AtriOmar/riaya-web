import api from "./api";
import type { SignedUploadUrlResponse } from "./types";

// ─── POST /api/upload/signed-url ──────────────────────────────────────────────

export type UploadFolder =
  | "profile-pictures"
  | "doctor-applications"
  | "medical-files";

export async function getSignedUploadUrl(
  filename: string,
  contentType: string,
  folder: UploadFolder,
): Promise<SignedUploadUrlResponse> {
  const { data } = await api.post<SignedUploadUrlResponse>(
    "/api/upload/signed-url",
    {
      filename,
      contentType,
      folder,
    },
  );
  return data;
}
