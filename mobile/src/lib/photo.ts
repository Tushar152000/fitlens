import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { api } from "./api";

export const MAX_SIDE = 1024;

/** Downscale so the longest side is ≤ `maxSide` (1024 px for plates; labels need more) and re-encode as JPEG. */
export async function compressPhoto(
  photo: { uri: string; width: number; height: number },
  maxSide = MAX_SIDE,
  quality = 0.82,
): Promise<string> {
  const ctx = ImageManipulator.manipulate(photo.uri);
  if (Math.max(photo.width, photo.height) > maxSide) {
    ctx.resize(photo.width >= photo.height ? { width: maxSide } : { height: maxSide });
  }
  const image = await ctx.renderAsync();
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: quality });
  return saved.uri;
}

/** Signed upload of a meal/label photo straight to storage. Returns the storage key. */
export async function uploadPhoto(uri: string): Promise<string> {
  const blob = await (await fetch(uri)).blob();
  const { key, uploadUrl } = await api<{ key: string; uploadUrl: string }>("/api/meals/upload-url", {
    json: { contentType: "image/jpeg", sizeBytes: blob.size },
  });
  const put = await fetch(uploadUrl, {
    method: "PUT",
    body: blob,
    headers: { "Content-Type": "image/jpeg" },
  }).catch(() => null);
  if (!put?.ok) throw new Error("Upload failed. Check your connection and try again.");
  return key;
}
