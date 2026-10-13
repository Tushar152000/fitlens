import type OpenAI from "openai";
import { LabelReadSchema, MealAnalysisSchema } from "@fitr8/contracts";
import { z, type ZodType } from "zod";
import { LABEL_SYSTEM_PROMPT, SYSTEM_PROMPT, photoUserPrompt, textUserPrompt } from "./prompts.js";
import type { AiResult, FoodExtractor, ImageInput, MealContext } from "./types.js";

type InputContent = OpenAI.Responses.ResponseInputMessageContentList;

/**
 * OpenAI Responses API with a JSON schema output format. The schema is sent non-strict (strict mode
 * rejects optional fields), so the reply is validated against the same Zod schema before use.
 */
export class OpenAiExtractor implements FoodExtractor {
  readonly name = "openai";

  constructor(
    private readonly client: OpenAI,
    private readonly model: string,
  ) {}

  analyzeMealPhoto({ image, context }: { image: ImageInput; context: MealContext }) {
    return this.extract("meal_analysis", MealAnalysisSchema, SYSTEM_PROMPT, [
      imagePart(image),
      { type: "input_text", text: photoUserPrompt(context) },
    ]);
  }

  parseMealText({ text, context }: { text: string; context: MealContext }) {
    return this.extract("meal_analysis", MealAnalysisSchema, SYSTEM_PROMPT, [
      { type: "input_text", text: textUserPrompt(text, context) },
    ]);
  }

  readNutritionLabel({ image }: { image: ImageInput }) {
    return this.extract("label_read", LabelReadSchema, LABEL_SYSTEM_PROMPT, [
      imagePart(image),
      { type: "input_text", text: "Read this nutrition label." },
    ]);
  }

  private async extract<T>(
    name: string,
    schema: ZodType<T>,
    instructions: string,
    content: InputContent,
  ): Promise<AiResult<T>> {
    const started = Date.now();
    const { $schema: _ignored, ...jsonSchema } = z.toJSONSchema(schema, {
      io: "output",
    }) as Record<string, unknown>;
    const res = await this.client.responses.create({
      model: this.model,
      max_output_tokens: 16_000,
      store: false,
      // Extraction is a perception task: low effort keeps latency and cost down without hurting accuracy.
      reasoning: { effort: "low" },
      // Identical instructions for every call of a kind, so the prefix caches across users.
      instructions,
      input: [{ role: "user", content }],
      text: { format: { type: "json_schema", name, schema: jsonSchema, strict: false } },
    });

    if (res.incomplete_details?.reason === "content_filter")
      throw new Error("The model declined to read this image");
    if (res.incomplete_details?.reason === "max_output_tokens")
      throw new Error("Model output was cut off");
    const parsed = schema.safeParse(parseJson(res.output_text));
    if (!parsed.success) throw new Error("Model did not return structured output");

    return {
      data: parsed.data,
      usage: {
        provider: this.name,
        model: res.model,
        tokensIn: res.usage?.input_tokens,
        tokensOut: res.usage?.output_tokens,
        latencyMs: Date.now() - started,
      },
    };
  }
}

function imagePart(image: ImageInput): OpenAI.Responses.ResponseInputImage {
  return {
    type: "input_image",
    detail: "auto",
    image_url: `data:${image.mediaType};base64,${image.data.toString("base64")}`,
  };
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
