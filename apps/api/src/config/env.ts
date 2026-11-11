import { z } from "zod";

/** Deployment templates often leave a variable as "" — treat that as unset. */
const emptyAsUndefined = (v: unknown) => (v === "" ? undefined : v);
const optional = z
  .string()
  .optional()
  .transform((v) => (v ? v : undefined));
const flag = z
  .string()
  .optional()
  .transform((v) => v === "true" || v === "1");
/** A flag whose default depends on the environment: undefined when unset. */
const optionalFlag = z
  .string()
  .optional()
  .transform((v) => (v ? v === "true" || v === "1" : undefined));

/**
 * Where this process runs — separate from NODE_ENV, which is *how* it runs (Docker images are always
 * NODE_ENV=production, including the local compose stack).
 *
 * - `local`: a developer machine. Works with no external accounts: dev sign-in, mock AI, MinIO.
 * - `test`: automated tests.
 * - `staging`, `production`: deployed. Strict: Google sign-in, https, no dev shortcuts.
 */
export const APP_ENVS = ["local", "test", "staging", "production"] as const;
export type AppEnv = (typeof APP_ENVS)[number];

/** APP_ENV if set; otherwise inferred from NODE_ENV, failing safe (production → production). */
export function resolveAppEnv(source: { APP_ENV?: string; NODE_ENV?: string }): AppEnv {
  const explicit = source.APP_ENV as AppEnv | undefined;
  if (explicit && APP_ENVS.includes(explicit)) return explicit;
  if (source.NODE_ENV === "production") return "production";
  if (source.NODE_ENV === "test") return "test";
  return "local";
}

/** Staging and production: real users, real Google, nothing that only makes sense on a laptop. */
export const isDeployed = (env: { APP_ENV: AppEnv }) =>
  env.APP_ENV === "staging" || env.APP_ENV === "production";

/** Extraction and coach model when AI_EXTRACTION_MODEL / AI_COACH_MODEL are unset. */
const DEFAULT_MODELS = {
  mock: "mock",
  anthropic: "claude-opus-5-5",
  openai: "gpt-6.1-sol",
} as const;

/** Every setting the service reads. Parsed once at boot; the process refuses to start on bad config. */
export const EnvSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    /** See AppEnv. Set it explicitly in every deployment (APP_ENV=staging|production). */
    APP_ENV: z.enum(APP_ENVS).optional(),
    /** `api` serves HTTP, `worker` runs queue consumers, `all` does both (local dev, single-box deploys). */
    APP_ROLE: z.enum(["api", "worker", "all"]).default("all"),
    PORT: z.coerce.number().int().positive().default(4000),
    LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),

    /** The web app's public origin: where sign-in returns users, and a trusted browser origin (CORS, CSRF). */
    PUBLIC_URL: z.string().url().default("http://localhost:3000"),
    /** This API's own public origin, e.g. https://api.fitr8.com. Builds OAuth redirect URIs. Defaults to PUBLIC_URL. */
    API_PUBLIC_URL: z.preprocess(emptyAsUndefined, z.string().url().optional()),
    /**
     * Domain for the session cookie when the web and the API are different hosts of one site, e.g.
     * `.fitr8.com` for www + api. Unset: a host-only cookie on the API's host (same host, or localhost
     * on different ports — cookies ignore the port).
     */
    AUTH_COOKIE_DOMAIN: z.preprocess(
      emptyAsUndefined,
      z
        .string()
        .regex(/^\.?[a-z0-9-]+(\.[a-z0-9-]+)+$/i, "a domain like .fitr8.com")
        .optional(),
    ),
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

    /** Root secret for sealed sign-in state (per-purpose keys are derived from it). `openssl rand -base64 33` */
    AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 characters"),
    AUTH_GOOGLE_ID: optional,
    AUTH_GOOGLE_SECRET: optional,
    /** Sign in with Apple: the iOS bundle id (e.g. com.fitr8.app), the identity token's audience. */
    APPLE_CLIENT_ID: optional,
    /** Apple Developer team id, and a "Sign in with Apple" key (id + .p8 contents): used to sign the
     *  client secret for exchanging and revoking tokens. Required when deployed with Apple on. */
    APPLE_TEAM_ID: optional,
    APPLE_KEY_ID: optional,
    APPLE_PRIVATE_KEY: optional,
    /** Email-only sign-in without Google (POST /api/auth/dev). Default: on locally and in tests; refused when deployed. */
    AUTH_DEV_LOGIN: optionalFlag,
    /** Web session idle lifetime: signed out after this many days without use. */
    SESSION_DAYS: z.coerce.number().int().positive().default(30),
    /** App session idle lifetime. */
    MOBILE_SESSION_DAYS: z.coerce.number().int().positive().default(90),
    /** Hard cap on any session, however active: sign in again after this. */
    SESSION_MAX_DAYS: z.coerce.number().int().positive().default(365),
    /** Requests per minute per IP to each sign-in route. */
    AUTH_RATE_LIMIT: z.coerce.number().int().positive().default(20),

    S3_ENDPOINT: optional,
    S3_REGION: z.string().default("us-east-1"),
    S3_BUCKET: z.string().default("fitlens-meals"),
    S3_ACCESS_KEY_ID: optional,
    S3_SECRET_ACCESS_KEY: optional,
    S3_FORCE_PATH_STYLE: flag,

    /** `mock` returns canned detections and a scripted coach so the whole app runs without an API key. */
    AI_PROVIDER: z.enum(["mock", "anthropic", "openai"]).default("mock"),
    ANTHROPIC_API_KEY: optional,
    OPENAI_API_KEY: optional,
    /** Model for photo/text/label extraction. Default depends on AI_PROVIDER (DEFAULT_MODELS). */
    AI_EXTRACTION_MODEL: optional,
    /** Model for the coach agent loop. Default depends on AI_PROVIDER (DEFAULT_MODELS). */
    AI_COACH_MODEL: optional,
    AI_COACH_EFFORT: z.enum(["low", "medium", "high", "xhigh", "max"]).default("medium"),
    /** Free photo scans per user per local day (typed meals and not-food photos never count). */
    AI_DAILY_LIMIT: z.coerce.number().int().positive().default(3),
    /** Coach messages per user per local day. */
    COACH_DAILY_LIMIT: z.coerce.number().int().positive().default(40),

    /** Pro photo scans per user per local day: fair use (docs/PREMIUM.md). */
    AI_PRO_DAILY_LIMIT: z.coerce.number().int().positive().default(30),
    /** Free coach messages per user per local day once the paywall is on (COACH_DAILY_LIMIT is Pro's). */
    COACH_FREE_DAILY_LIMIT: z.coerce.number().int().positive().default(5),
    /** Turn on Pro gating (free limits, label scans for Pro). Off: everyone keeps today's limits. */
    PAYWALL_ENABLED: flag,
    /** Exact Authorization header value set on the RevenueCat webhook. */
    REVENUECAT_WEBHOOK_AUTH: optional,
    /** RevenueCat secret API key (sk_…): reads a customer's current state after a webhook or purchase. */
    REVENUECAT_SECRET_KEY: optional,
    /** RevenueCat entitlement identifier that means FITR8 Pro. */
    REVENUECAT_ENTITLEMENT: z.string().default("pro"),

    OFF_CONTACT: optional,
  })
  // Resolve environment-dependent defaults, then validate the result.
  .transform((env) => {
    const APP_ENV = env.APP_ENV ?? resolveAppEnv(env);
    return {
      ...env,
      APP_ENV,
      AUTH_DEV_LOGIN: env.AUTH_DEV_LOGIN ?? (APP_ENV === "local" || APP_ENV === "test"),
      AI_EXTRACTION_MODEL: env.AI_EXTRACTION_MODEL ?? DEFAULT_MODELS[env.AI_PROVIDER],
      AI_COACH_MODEL: env.AI_COACH_MODEL ?? DEFAULT_MODELS[env.AI_PROVIDER],
      API_PUBLIC_URL: env.API_PUBLIC_URL ?? env.PUBLIC_URL,
    };
  })
  .superRefine((env, ctx) => {
    if (env.AI_PROVIDER === "anthropic" && !env.ANTHROPIC_API_KEY) {
      ctx.addIssue({
        code: "custom",
        path: ["ANTHROPIC_API_KEY"],
        message: "required when AI_PROVIDER=anthropic",
      });
    }
    if (env.AI_PROVIDER === "openai" && !env.OPENAI_API_KEY) {
      ctx.addIssue({
        code: "custom",
        path: ["OPENAI_API_KEY"],
        message: "required when AI_PROVIDER=openai",
      });
    }
    if (isDeployed(env)) {
      const where = `in ${env.APP_ENV}`;
      if (env.AUTH_DEV_LOGIN) {
        ctx.addIssue({ code: "custom", path: ["AUTH_DEV_LOGIN"], message: `must be off ${where}` });
      }
      if (!env.AUTH_GOOGLE_ID || !env.AUTH_GOOGLE_SECRET) {
        ctx.addIssue({
          code: "custom",
          path: ["AUTH_GOOGLE_ID"],
          message: `required ${where}, where Google is the only sign-in: set AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET`,
        });
      }
      if (
        env.APPLE_CLIENT_ID &&
        !(env.APPLE_TEAM_ID && env.APPLE_KEY_ID && env.APPLE_PRIVATE_KEY)
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["APPLE_PRIVATE_KEY"],
          message: `required ${where} with Sign in with Apple on (account deletion must revoke it): set APPLE_TEAM_ID, APPLE_KEY_ID and APPLE_PRIVATE_KEY`,
        });
      }
      for (const key of ["PUBLIC_URL", "API_PUBLIC_URL"] as const) {
        if (!env[key].startsWith("https://")) {
          ctx.addIssue({
            code: "custom",
            path: [key],
            message: `must be https ${where} (session cookies are Secure)`,
          });
        }
      }
    }
    const webHost = new URL(env.PUBLIC_URL).hostname;
    const apiHost = new URL(env.API_PUBLIC_URL).hostname;
    if (env.AUTH_COOKIE_DOMAIN) {
      const domain = env.AUTH_COOKIE_DOMAIN.replace(/^\./, "").toLowerCase();
      const covers = (host: string) => host === domain || host.endsWith(`.${domain}`);
      if (!covers(webHost) || !covers(apiHost)) {
        ctx.addIssue({
          code: "custom",
          path: ["AUTH_COOKIE_DOMAIN"],
          message: `must cover both ${webHost} (PUBLIC_URL) and ${apiHost} (API_PUBLIC_URL)`,
        });
      }
    } else if (webHost !== apiHost) {
      ctx.addIssue({
        code: "custom",
        path: ["AUTH_COOKIE_DOMAIN"],
        message: `required when the web (${webHost}) and the API (${apiHost}) are different hosts, so the web can read the session`,
      });
    }
    if (
      isDeployed(env) &&
      env.PAYWALL_ENABLED &&
      !(env.REVENUECAT_WEBHOOK_AUTH && env.REVENUECAT_SECRET_KEY)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["REVENUECAT_WEBHOOK_AUTH"],
        message: `required in ${env.APP_ENV} with PAYWALL_ENABLED: set REVENUECAT_WEBHOOK_AUTH and REVENUECAT_SECRET_KEY`,
      });
    }
    if (env.SESSION_DAYS > env.SESSION_MAX_DAYS || env.MOBILE_SESSION_DAYS > env.SESSION_MAX_DAYS) {
      ctx.addIssue({
        code: "custom",
        path: ["SESSION_MAX_DAYS"],
        message: "must be at least SESSION_DAYS and MOBILE_SESSION_DAYS",
      });
    }
  });

export type Env = z.infer<typeof EnvSchema>;

export function parseEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = EnvSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n");
    const hint =
      resolveAppEnv(source) === "local"
        ? "\nLocal setup: run `pnpm bootstrap` (creates and repairs .env)."
        : "";
    throw new Error(
      `Invalid environment variables (APP_ENV=${resolveAppEnv(source)}):\n${issues}${hint}`,
    );
  }
  return parsed.data;
}
