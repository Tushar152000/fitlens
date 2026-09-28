import {
  CreateBucketCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Injectable, Logger, type OnApplicationBootstrap } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { InjectEnv, type Env } from "../../config/config.module.js";

export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic"] as const;
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

/** Private object storage (S3, R2 or MinIO). Clients upload/download with short-lived signed URLs. */
@Injectable()
export class StorageService implements OnApplicationBootstrap {
  private readonly logger = new Logger(StorageService.name);
  private readonly s3: S3Client;
  private readonly bucket: string;

  constructor(@InjectEnv() private readonly env: Env) {
    this.bucket = env.S3_BUCKET;
    this.s3 = new S3Client({
      region: env.S3_REGION,
      endpoint: env.S3_ENDPOINT,
      forcePathStyle: env.S3_FORCE_PATH_STYLE,
      credentials:
        env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY
          ? { accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY }
          : undefined,
    });
  }

  /** Local MinIO starts empty: create the bucket outside production so `pnpm dev` just works. */
  async onApplicationBootstrap() {
    if (this.env.NODE_ENV === "production" || !this.env.S3_ENDPOINT) return;
    try {
      await this.s3.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch {
      await this.s3
        .send(new CreateBucketCommand({ Bucket: this.bucket }))
        .then(() => this.logger.log(`Created bucket ${this.bucket}`))
        .catch((err: Error) => this.logger.warn(`Storage not reachable: ${err.message}`));
    }
  }

  /** Private per-user key, e.g. meals/<userId>/<uuid>.jpg */
  mealPhotoKey(userId: string, contentType: string): string {
    const ext = contentType.split("/")[1]?.replace("jpeg", "jpg") ?? "jpg";
    return `meals/${userId}/${randomUUID()}.${ext}`;
  }

  /** The client PUTs the (compressed) image straight to storage with this URL. */
  presignUpload(key: string, contentType: string, expiresIn = 300) {
    return getSignedUrl(
      this.s3,
      new PutObjectCommand({ Bucket: this.bucket, Key: key, ContentType: contentType }),
      {
        expiresIn,
      },
    );
  }

  /** Short-lived read URL for the UI. */
  presignRead(key: string, expiresIn = 600) {
    return getSignedUrl(this.s3, new GetObjectCommand({ Bucket: this.bucket, Key: key }), {
      expiresIn,
    });
  }

  /** Signed read URL, or null if signing fails (a missing photo must never break a screen). */
  async presignReadOrNull(
    key: string | null | undefined,
    expiresIn = 3600,
  ): Promise<string | null> {
    if (!key) return null;
    return this.presignRead(key, expiresIn).catch(() => null);
  }

  /**
   * The object's bytes, for sending an image to the model inline. We read from storage ourselves so the
   * AI provider never needs network access to our bucket (local MinIO works too).
   */
  async getImage(key: string): Promise<{ data: Buffer; mediaType: string }> {
    const res = await this.s3.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    const mediaType = res.ContentType?.split(";")[0] || "image/jpeg";
    if (!mediaType.startsWith("image/"))
      throw new Error(`Stored photo has unexpected type ${mediaType}`);
    const bytes = Buffer.from(await res.Body!.transformToByteArray());
    if (bytes.length > MAX_IMAGE_BYTES) throw new Error("Photo is larger than 10 MB");
    return { data: bytes, mediaType };
  }
}
