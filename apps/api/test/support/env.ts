/** e2e tests run against a separate database so they never touch dev data. */
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgresql://fitlens:fitlens@localhost:5432/fitlens_test?schema=public";

/** Everything the app needs, with AI mocked, no Redis (jobs run inline) and dev login on. */
export function applyTestEnv() {
  Object.assign(process.env, {
    NODE_ENV: "test",
    APP_ENV: "test",
    APP_ROLE: "api",
    LOG_LEVEL: "error",
    DATABASE_URL: TEST_DATABASE_URL,
    REDIS_URL: "",
    AUTH_SECRET: "test-secret-please-change-0123456789",
    AUTH_DEV_LOGIN: "true",
    // Tests sign in many users from one IP; the auth e2e suite checks throttling with its own app.
    AUTH_RATE_LIMIT: "100000",
    AI_PROVIDER: "mock",
    S3_ENDPOINT: "http://127.0.0.1:1", // unreachable on purpose: storage calls must degrade gracefully
    S3_ACCESS_KEY_ID: "test",
    S3_SECRET_ACCESS_KEY: "test",
    PUBLIC_URL: "http://localhost:3000",
  });
}
