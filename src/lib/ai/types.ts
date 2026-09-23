import type { MealAnalysis } from "./schemas";
import type { MealContext } from "./prompts";

export interface AiUsage {
  provider: string;
  model: string;
  tokensIn?: number;
  tokensOut?: number;
  latencyMs: number;
}

export interface AiResult<T> {
  data: T;
  usage: AiUsage;
}

/** Swap providers (Anthropic, OpenAI, Gemini, a mock) without touching callers. */
export interface AiProvider {
  readonly name: string;
  analyzeMealPhoto(input: {
    imageUrl: string;
    context: MealContext;
  }): Promise<AiResult<MealAnalysis>>;
  parseMealText(input: { text: string; context: MealContext }): Promise<AiResult<MealAnalysis>>;
}
