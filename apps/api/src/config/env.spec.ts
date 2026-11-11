import { describe, expect, it } from "vitest";
import { isDeployed, parseEnv, resolveAppEnv } from "./env.js";

const base = {
  DATABASE_URL: "postgresql://u:p@localhost:5432/db",
  AUTH_SECRET: "x".repeat(32),
};
const deployed = {
  ...base,
  NODE_ENV: "production",
  PUBLIC_URL: "https://fitlens.app",
  AUTH_GOOGLE_ID: "id.apps.googleusercontent.com",
  AUTH_GOOGLE_SECRET: "secret",
};

describe("resolveAppEnv", () => {
  it.each([
    [{}, "local"],
    [{ NODE_ENV: "development" }, "local"],
    [{ NODE_ENV: "test" }, "test"],
    // Fail safe: a production build without APP_ENV gets production rules.
    [{ NODE_ENV: "production" }, "production"],
    // The local Docker stack: a production build on a laptop.
    [{ NODE_ENV: "production", APP_ENV: "local" }, "local"],
    [{ APP_ENV: "staging" }, "staging"],
    [{ APP_ENV: "nonsense", NODE_ENV: "production" }, "production"],
  ])("%j → %s", (source, expected) => {
    expect(resolveAppEnv(source)).toBe(expected);
  });

  it("treats only staging and production as deployed", () => {
    expect(isDeployed({ APP_ENV: "production" })).toBe(true);
    expect(isDeployed({ APP_ENV: "staging" })).toBe(true);
    expect(isDeployed({ APP_ENV: "local" })).toBe(false);
    expect(isDeployed({ APP_ENV: "test" })).toBe(false);
  });
});

describe("parseEnv", () => {
  it("runs locally with nothing but a database and a secret", () => {
    expect(parseEnv(base)).toMatchObject({
      APP_ENV: "local",
      AUTH_DEV_LOGIN: true,
      AI_PROVIDER: "mock",
      PUBLIC_URL: "http://localhost:3000",
      SESSION_DAYS: 30,
      MOBILE_SESSION_DAYS: 90,
      SESSION_MAX_DAYS: 365,
      AUTH_RATE_LIMIT: 20,
    });
  });

  it("picks model defaults from the AI provider, and requires that provider's key", () => {
    expect(parseEnv({ ...base, AI_PROVIDER: "openai", OPENAI_API_KEY: "sk-x" })).toMatchObject({
      AI_EXTRACTION_MODEL: "gpt-6.1-sol",
      AI_COACH_MODEL: "gpt-6.1-sol",
    });
    expect(
      parseEnv({ ...base, AI_PROVIDER: "anthropic", ANTHROPIC_API_KEY: "sk-ant-x" }).AI_COACH_MODEL,
    ).toBe("claude-opus-5-5");
    expect(
      parseEnv({
        ...base,
        AI_PROVIDER: "openai",
        OPENAI_API_KEY: "k",
        AI_COACH_MODEL: "gpt-6-luna",
      }).AI_COACH_MODEL,
    ).toBe("gpt-6-luna");
    expect(() => parseEnv({ ...base, AI_PROVIDER: "openai" })).toThrow(/OPENAI_API_KEY/);
  });

  it("lets a developer turn dev sign-in off locally", () => {
    expect(parseEnv({ ...base, AUTH_DEV_LOGIN: "false" }).AUTH_DEV_LOGIN).toBe(false);
  });

  it("keeps dev sign-in off by default when deployed", () => {
    expect(parseEnv(deployed)).toMatchObject({ APP_ENV: "production", AUTH_DEV_LOGIN: false });
    expect(parseEnv({ ...deployed, APP_ENV: "staging" }).APP_ENV).toBe("staging");
  });

  it("boots the local Docker stack (production build, plain http, no Google)", () => {
    const env = parseEnv({ ...base, NODE_ENV: "production", APP_ENV: "local" });
    expect(env).toMatchObject({ APP_ENV: "local", AUTH_DEV_LOGIN: true });
  });

  it("requires a 32+ character AUTH_SECRET and says how to fix it locally", () => {
    expect(() => parseEnv({ ...base, AUTH_SECRET: "short-secret-16ch" })).toThrow(
      /AUTH_SECRET[\s\S]*pnpm bootstrap/,
    );
  });

  it.each(["staging", "production"])("refuses to boot an unsafe %s config", (APP_ENV) => {
    const env = { ...deployed, APP_ENV };
    expect(() => parseEnv({ ...env, AUTH_DEV_LOGIN: "true" })).toThrow(
      `AUTH_DEV_LOGIN: must be off in ${APP_ENV}`,
    );
    expect(() => parseEnv({ ...env, AUTH_GOOGLE_SECRET: "" })).toThrow(
      /AUTH_GOOGLE_ID: required in (staging|production), where Google is the only sign-in/,
    );
    expect(() => parseEnv({ ...env, PUBLIC_URL: "http://fitlens.app" })).toThrow(
      /PUBLIC_URL: must be https/,
    );
  });

  it("serves the API from the web's origin unless told otherwise", () => {
    expect(parseEnv(base).API_PUBLIC_URL).toBe("http://localhost:3000");
    // Templates leave unused values empty: "" means unset, not an invalid URL.
    expect(
      parseEnv({ ...base, API_PUBLIC_URL: "", AUTH_COOKIE_DOMAIN: "" }).AUTH_COOKIE_DOMAIN,
    ).toBeUndefined();
    // Local split: web :3000, API :4000. Same host, so no cookie domain is needed.
    expect(parseEnv({ ...base, API_PUBLIC_URL: "http://localhost:4000" }).API_PUBLIC_URL).toBe(
      "http://localhost:4000",
    );
  });

  it("needs a shared cookie domain when the web and the API are different hosts", () => {
    const split = {
      ...deployed,
      PUBLIC_URL: "https://www.fitr8.com",
      API_PUBLIC_URL: "https://api.fitr8.com",
    };
    expect(() => parseEnv(split)).toThrow(/AUTH_COOKIE_DOMAIN: required when the web/);
    expect(parseEnv({ ...split, AUTH_COOKIE_DOMAIN: ".fitr8.com" }).AUTH_COOKIE_DOMAIN).toBe(
      ".fitr8.com",
    );
    expect(() => parseEnv({ ...split, AUTH_COOKIE_DOMAIN: ".other.com" })).toThrow(
      /AUTH_COOKIE_DOMAIN: must cover both www.fitr8.com/,
    );
    expect(() =>
      parseEnv({
        ...split,
        AUTH_COOKIE_DOMAIN: ".fitr8.com",
        API_PUBLIC_URL: "http://api.fitr8.com",
      }),
    ).toThrow(/API_PUBLIC_URL: must be https/);
  });

  it("keeps the hard session limit above the idle windows", () => {
    expect(() => parseEnv({ ...base, SESSION_MAX_DAYS: "60" })).toThrow(/SESSION_MAX_DAYS/);
  });
});
