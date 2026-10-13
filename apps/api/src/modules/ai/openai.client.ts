import OpenAI from "openai";
import type { Env } from "../../config/config.module.js";

export const OPENAI = Symbol("OPENAI");

export function createOpenAI(env: Env): OpenAI | null {
  if (env.AI_PROVIDER !== "openai") return null;
  // maxRetries covers 408/409/429/5xx and connection errors with backoff.
  return new OpenAI({ apiKey: env.OPENAI_API_KEY, maxRetries: 3, timeout: 120_000 });
}
