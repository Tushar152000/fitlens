import OpenAI from "openai";
import type { ZodType } from "zod";
import { imageUrlToDataUrl } from "./image";
import {
  LABEL_SYSTEM_PROMPT,
  SYSTEM_PROMPT,
  photoUserPrompt,
  textUserPrompt,
  type MealContext,
} from "./prompts";
import {
  LabelReadSchema,
  labelReadJsonSchema,
  MealAnalysisSchema,
  mealAnalysisJsonSchema,
} from "./schemas";
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

export class OpenAIProvider implements AiProvider {
  readonly name = "openai";
  private client: OpenAI;

  constructor(
    apiKey: string,
    private visionModel: string,
    private textModel: string,
  ) {
    this.client = new OpenAI({ apiKey });
  }

  async analyzeMealPhoto({ imageUrl, context }: { imageUrl: string; context: MealContext }) {
    const dataUrl = await imageUrlToDataUrl(imageUrl);
    return this.call(this.visionModel, SYSTEM_PROMPT, MEAL_TOOL, [
      { type: "image_url", image_url: { url: dataUrl, detail: "high" } },
      { type: "text", text: photoUserPrompt(context) },
    ]);
  }

  parseMealText({ text, context }: { text: string; context: MealContext }) {
    return this.call(this.textModel, SYSTEM_PROMPT, MEAL_TOOL, [
      { type: "text", text: textUserPrompt(text, context) },
    ]);
  }

  async readNutritionLabel({ imageUrl }: { imageUrl: string }) {
    const dataUrl = await imageUrlToDataUrl(imageUrl);
    return this.call(this.visionModel, LABEL_SYSTEM_PROMPT, LABEL_TOOL, [
      { type: "image_url", image_url: { url: dataUrl, detail: "high" } },
      { type: "text", text: "Read this nutrition label." },
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
    content: OpenAI.Chat.ChatCompletionContentPart[],
  ): Promise<AiResult<T>> {
    const started = Date.now();
    const res = await this.client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: tool.name,
            description: tool.description,
            // Not strict: strict mode needs every field required, and some are optional.
            // The Zod parse below enforces the schema instead.
            parameters: tool.parameters(),
          },
        },
      ],
      tool_choice: { type: "function", function: { name: tool.name } },
    });

    const message = res.choices[0]?.message;
    if (message?.refusal) throw new Error(`Model declined: ${message.refusal}`);
    const call = message?.tool_calls?.find(
      (c) => c.type === "function" && c.function.name === tool.name,
    );
    if (!call || call.type !== "function") {
      throw new Error("Model did not return structured output");
    }
    const data = tool.schema.parse(JSON.parse(call.function.arguments));

    return {
      data,
      usage: {
        provider: this.name,
        model: res.model,
        tokensIn: res.usage?.prompt_tokens,
        tokensOut: res.usage?.completion_tokens,
        latencyMs: Date.now() - started,
      },
    };
  }
}
