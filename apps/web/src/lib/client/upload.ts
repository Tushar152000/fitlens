import { api } from "./api";

/** Signed upload of a meal/label photo straight to storage. Returns the storage key. */
export async function uploadPhoto(blob: Blob): Promise<string> {
  const { key, uploadUrl } = await api<{ key: string; uploadUrl: string }>(
    "/api/meals/upload-url",
    {
      method: "POST",
      json: { contentType: "image/jpeg", sizeBytes: blob.size },
    },
  );
  const put = await fetch(uploadUrl, {
    method: "PUT",
    body: blob,
    headers: { "Content-Type": "image/jpeg" },
  }).catch(() => null);
  if (!put?.ok) throw new Error("Upload failed. Check your connection and try again.");
  return key;
}
