import Anthropic from "@anthropic-ai/sdk";
import type { ZodType } from "zod";
import {
  LabelReadSchema,
  labelReadJsonSchema,
  MealAnalysisSchema,
  mealAnalysisJsonSchema,
} from "./schemas";
import {
  LABEL_SYSTEM_PROMPT,
  SYSTEM_PROMPT,
  photoUserPrompt,
  textUserPrompt,
  type MealContext,
} from "./prompts";
import type { AiProvider, AiResult } from "./types";

const MEAL_TOOL = {
  name: "record_meal",
  description: "Record the foods detected in the meal",
  parameters: mealAnalysisJsonSchema,
  schema: MealAnalysisSchema,
};
const LABEL_TOOL = {
  name: "record_label",
  description: "Record the nutrition values read from the label",
  parameters: labelReadJsonSchema,
  schema: LabelReadSchema,
};

export class AnthropicProvider implements AiProvider {
  readonly name = "anthropic";
  private client: Anthropic;

  constructor(
    apiKey: string,
    private visionModel: string,
    private textModel: string,
  ) {
    this.client = new Anthropic({ apiKey });
  }

  analyzeMealPhoto({ imageUrl, context }: { imageUrl: string; context: MealContext }) {
    return this.call(this.visionModel, SYSTEM_PROMPT, MEAL_TOOL, [
      { type: "image", source: { type: "url", url: imageUrl } },
      { type: "text", text: photoUserPrompt(context) },
    ]);
  }

  readNutritionLabel({ imageUrl }: { imageUrl: string }) {
    return this.call(this.visionModel, LABEL_SYSTEM_PROMPT, LABEL_TOOL, [
      { type: "image", source: { type: "url", url: imageUrl } },
      { type: "text", text: "Read this nutrition label." },
    ]);
  }

  parseMealText({ text, context }: { text: string; context: MealContext }) {
    return this.call(this.textModel, SYSTEM_PROMPT, MEAL_TOOL, [
      { type: "text", text: textUserPrompt(text, context) },
    ]);
  }

  /** Forces a call to one tool so the model must return JSON matching its schema. */
  private async call<T>(
    model: string,
    system: string,
    tool: {
      name: string;
      description: string;
      parameters: () => Record<string, unknown>;
      schema: ZodType<T>;
    },
    content: Anthropic.ContentBlockParam[],
  ): Promise<AiResult<T>> {
    const started = Date.now();
    const res = await this.client.messages.create({
      model,
      max_tokens: 1024,
      system,
      tools: [
        {
          name: tool.name,
          description: tool.description,
          input_schema: tool.parameters() as Anthropic.Tool.InputSchema,
        },
      ],
      tool_choice: { type: "tool", name: tool.name },
      messages: [{ role: "user", content }],
    });

    const block = res.content.find((b) => b.type === "tool_use");
    if (!block || block.type !== "tool_use")
      throw new Error("Model did not return structured output");
    const data = tool.schema.parse(block.input);

    return {
      data,
      usage: {
        provider: this.name,
        model,
        tokensIn: res.usage.input_tokens,
        tokensOut: res.usage.output_tokens,
        latencyMs: Date.now() - started,
      },
    };
  }
}
