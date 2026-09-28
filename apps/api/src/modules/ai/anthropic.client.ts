import { Inject } from "@nestjs/common";
import Anthropic from "@anthropic-ai/sdk";
import type { Env } from "../../config/config.module.js";

export const ANTHROPIC = Symbol("ANTHROPIC");
/** The shared Claude client, or null when AI_PROVIDER=mock. */
export const InjectAnthropic = () => Inject(ANTHROPIC);

/**
 * Refusal handling for Claude Opus 5.5+: on a policy decline the API re-runs the request on a
 * fallback model inside the same call, routed by refusal category (no model list to maintain).
 */
export const FALLBACK_BETA = "server-side-fallback-2026-07-01";

export function createAnthropic(env: Env): Anthropic | null {
  if (env.AI_PROVIDER !== "anthropic") return null;
  // maxRetries covers 408/409/429/5xx and connection errors with backoff.
  return new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, maxRetries: 3, timeout: 120_000 });
}
