import { env } from "@/lib/env";
import { AnthropicProvider } from "./anthropic";
import { MockProvider } from "./mock";
import { OpenAIProvider } from "./openai";
import type { AiProvider } from "./types";

export * from "./schemas";
export * from "./types";
export type { MealContext } from "./prompts";

let provider: AiProvider | undefined;

export function ai(): AiProvider {
  if (provider) return provider;
  const e = env();
  if (e.AI_PROVIDER !== "mock" && !e.AI_VISION_MODEL) {
    throw new Error("Set AI_VISION_MODEL to a vision-capable model id");
  }
  if (e.AI_PROVIDER === "anthropic") {
    provider = new AnthropicProvider(
      e.ANTHROPIC_API_KEY!,
      e.AI_VISION_MODEL!,
      e.AI_TEXT_MODEL ?? e.AI_VISION_MODEL!,
    );
  } else if (e.AI_PROVIDER === "openai") {
    provider = new OpenAIProvider(
      e.OPENAI_API_KEY!,
      e.AI_VISION_MODEL!,
      e.AI_TEXT_MODEL ?? e.AI_VISION_MODEL!,
    );
  } else {
    provider = new MockProvider();
  }
  return provider;
}
