import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "@/lib/env";

let client: S3Client | undefined;

function s3(): S3Client {
  if (client) return client;
  const e = env();
  client = new S3Client({
    region: e.S3_REGION,
    endpoint: e.S3_ENDPOINT,
    forcePathStyle: e.S3_FORCE_PATH_STYLE,
    credentials:
      e.S3_ACCESS_KEY_ID && e.S3_SECRET_ACCESS_KEY
        ? { accessKeyId: e.S3_ACCESS_KEY_ID, secretAccessKey: e.S3_SECRET_ACCESS_KEY }
        : undefined,
  });
  return client;
}

export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic"] as const;
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

/** Private per-user key, e.g. meals/<userId>/<uuid>.jpg */
export function mealPhotoKey(userId: string, contentType: string): string {
  const ext = contentType.split("/")[1]?.replace("jpeg", "jpg") ?? "jpg";
  return `meals/${userId}/${crypto.randomUUID()}.${ext}`;
}

/** Browser uploads straight to storage with this URL (expires in 5 min). */
export function presignUpload(key: string, contentType: string) {
  return getSignedUrl(
    s3(),
    new PutObjectCommand({ Bucket: env().S3_BUCKET, Key: key, ContentType: contentType }),
    { expiresIn: 300 },
  );
}

/** Short-lived read URL for the AI provider or the UI. */
export function presignRead(key: string, expiresIn = 600) {
  return getSignedUrl(s3(), new GetObjectCommand({ Bucket: env().S3_BUCKET, Key: key }), {
    expiresIn,
  });
}
