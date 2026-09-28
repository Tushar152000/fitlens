import { z } from "zod";

const optional = z
  .string()
  .optional()
  .transform((v) => (v ? v : undefined));
const flag = z
  .string()
  .optional()
  .transform((v) => v === "true" || v === "1");

/** Every setting the service reads. Parsed once at boot; the process refuses to start on bad config. */
export const EnvSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    /** `api` serves HTTP, `worker` runs queue consumers, `all` does both (local dev, single-box deploys). */
    APP_ROLE: z.enum(["api", "worker", "all"]).default("all"),
    PORT: z.coerce.number().int().positive().default(4000),
    LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),

    /** The public origin clients use (web domain; it proxies /api to this service). Builds OAuth redirect URIs. */
    PUBLIC_URL: z.string().url().default("http://localhost:3000"),
    /** Extra browser origins allowed to call the API directly (comma separated), e.g. Expo web on :8081. */
    CORS_ORIGINS: z
      .string()
      .default("")
      .transform((v) =>
        v
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      ),

    DATABASE_URL: z.string().url(),
    DATABASE_POOL_MAX: z.coerce.number().int().positive().default(10),
    REDIS_URL: optional,

    AUTH_SECRET: z.string().min(16, "AUTH_SECRET must be at least 16 characters"),
    AUTH_GOOGLE_ID: optional,
    AUTH_GOOGLE_SECRET: optional,
    /** Local only: enables POST /api/auth/dev to sign in by email without Google. Ignored in production. */
    AUTH_DEV_LOGIN: flag,
    SESSION_DAYS: z.coerce.number().int().positive().default(30),

    S3_ENDPOINT: optional,
    S3_REGION: z.string().default("us-east-1"),
    S3_BUCKET: z.string().default("fitlens-meals"),
    S3_ACCESS_KEY_ID: optional,
    S3_SECRET_ACCESS_KEY: optional,
    S3_FORCE_PATH_STYLE: flag,

    /** `mock` returns canned detections and a scripted coach so the whole app runs without an API key. */
    AI_PROVIDER: z.enum(["mock", "anthropic"]).default("mock"),
    ANTHROPIC_API_KEY: optional,
    /** Model for photo/text/label extraction. */
    AI_EXTRACTION_MODEL: z.string().default("claude-opus-5-5"),
    /** Model for the coach agent loop. */
    AI_COACH_MODEL: z.string().default("claude-opus-5-5"),
    AI_COACH_EFFORT: z.enum(["low", "medium", "high", "xhigh", "max"]).default("medium"),
    /** Free photo scans per user per local day (typed meals and not-food photos never count). */
    AI_DAILY_LIMIT: z.coerce.number().int().positive().default(3),
    /** Coach messages per user per local day. */
    COACH_DAILY_LIMIT: z.coerce.number().int().positive().default(40),

    OFF_CONTACT: optional,
  })
  .superRefine((env, ctx) => {
    if (env.AI_PROVIDER === "anthropic" && !env.ANTHROPIC_API_KEY) {
      ctx.addIssue({
        code: "custom",
        path: ["ANTHROPIC_API_KEY"],
        message: "required when AI_PROVIDER=anthropic",
      });
    }
    if (env.NODE_ENV === "production" && env.AUTH_DEV_LOGIN) {
      ctx.addIssue({
        code: "custom",
        path: ["AUTH_DEV_LOGIN"],
        message: "must be off in production",
      });
    }
  });

export type Env = z.infer<typeof EnvSchema>;

export function parseEnv(source: NodeJS.ProcessEnv = process.env): Env {
  // Accept the old Auth.js name so existing deployments keep working.
  const input = { ...source, PUBLIC_URL: source.PUBLIC_URL ?? source.AUTH_URL };
  const parsed = EnvSchema.safeParse(input);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid environment variables:\n${issues}`);
  }
  return parsed.data;
}
