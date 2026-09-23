const MAX_BYTES = 10 * 1024 * 1024;

/**
 * Download a (signed) image URL on our server and return it as a base64 data URL.
 * Sending bytes instead of a link means the AI provider never has to reach our storage,
 * so local MinIO works too.
 */
export async function imageUrlToDataUrl(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Couldn't read the meal photo from storage (${res.status})`);
  const type = res.headers.get("content-type")?.split(";")[0] || "image/jpeg";
  if (!type.startsWith("image/")) throw new Error(`Meal photo has unexpected type ${type}`);
  const bytes = Buffer.from(await res.arrayBuffer());
  if (bytes.length > MAX_BYTES) throw new Error("Meal photo is larger than 10 MB");
  return `data:${type};base64,${bytes.toString("base64")}`;
}
