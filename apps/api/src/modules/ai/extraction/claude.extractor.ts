import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { LabelReadSchema, MealAnalysisSchema } from "@fitr8/contracts";
import type { ZodType } from "zod";
import { FALLBACK_BETA } from "../anthropic.client.js";
import { LABEL_SYSTEM_PROMPT, SYSTEM_PROMPT, photoUserPrompt, textUserPrompt } from "./prompts.js";
import type { AiResult, FoodExtractor, ImageInput, MealContext } from "./types.js";

type ImageMediaType = "image/jpeg" | "image/png" | "image/gif" | "image/webp";

/**
 * Claude with structured outputs (`output_config.format`): the response is constrained to the Zod
 * schema and parsed by the SDK. Forced tool choice is not used — current models reject it.
 */
export class ClaudeExtractor implements FoodExtractor {
  readonly name = "anthropic";

  constructor(
    private readonly client: Anthropic,
    private readonly model: string,
  ) {}

  analyzeMealPhoto({ image, context }: { image: ImageInput; context: MealContext }) {
    return this.extract(MealAnalysisSchema, SYSTEM_PROMPT, [
      imageBlock(image),
      { type: "text", text: photoUserPrompt(context) },
    ]);
  }

  parseMealText({ text, context }: { text: string; context: MealContext }) {
    return this.extract(MealAnalysisSchema, SYSTEM_PROMPT, [
      { type: "text", text: textUserPrompt(text, context) },
    ]);
  }

  readNutritionLabel({ image }: { image: ImageInput }) {
    return this.extract(LabelReadSchema, LABEL_SYSTEM_PROMPT, [
      imageBlock(image),
      { type: "text", text: "Read this nutrition label." },
    ]);
  }

  private async extract<T>(
    schema: ZodType<T>,
    system: string,
    content: Anthropic.Beta.BetaContentBlockParam[],
  ): Promise<AiResult<T>> {
    const started = Date.now();
    const res = await this.client.beta.messages.parse({
      model: this.model,
      max_tokens: 16000,
      betas: [FALLBACK_BETA],
      fallbacks: "default",
      // Extraction is a perception task: low effort keeps latency and cost down without hurting accuracy.
      output_config: { effort: "low", format: betaZodOutputFormat(schema) },
      // The system prompt is identical for every call of a kind, so it caches across users.
      system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content }],
    });

    if (res.stop_reason === "refusal") throw new Error("The model declined to read this image");
    if (res.stop_reason === "max_tokens") throw new Error("Model output was cut off");
    const data = res.parsed_output;
    if (data == null) throw new Error("Model did not return structured output");

    return {
      data: data as T,
      usage: {
        provider: this.name,
        model: res.model,
        tokensIn: res.usage.input_tokens + (res.usage.cache_read_input_tokens ?? 0),
        tokensOut: res.usage.output_tokens,
        latencyMs: Date.now() - started,
      },
    };
  }
}

function imageBlock(image: ImageInput): Anthropic.Beta.BetaImageBlockParam {
  return {
    type: "image",
    source: {
      type: "base64",
      media_type: image.mediaType as ImageMediaType,
      data: image.data.toString("base64"),
    },
  };
}
