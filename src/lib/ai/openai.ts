import OpenAI from "openai";
import { imageUrlToDataUrl } from "./image";
import { SYSTEM_PROMPT, photoUserPrompt, textUserPrompt, type MealContext } from "./prompts";
import { MealAnalysisSchema, mealAnalysisJsonSchema, type MealAnalysis } from "./schemas";
import type { AiProvider, AiResult } from "./types";

const TOOL_NAME = "record_meal";

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
    return this.call(this.visionModel, [
      { type: "image_url", image_url: { url: dataUrl, detail: "high" } },
      { type: "text", text: photoUserPrompt(context) },
    ]);
  }

  parseMealText({ text, context }: { text: string; context: MealContext }) {
    return this.call(this.textModel, [{ type: "text", text: textUserPrompt(text, context) }]);
  }

  /** Forces a call to record_meal so the model must return JSON matching our schema. */
  private async call(
    model: string,
    content: OpenAI.Chat.ChatCompletionContentPart[],
  ): Promise<AiResult<MealAnalysis>> {
    const started = Date.now();
    const res = await this.client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: TOOL_NAME,
            description: "Record the foods detected in the meal",
            // Not strict: strict mode needs every field required, and per100g/notes are optional.
            // The Zod parse below enforces the schema instead.
            parameters: mealAnalysisJsonSchema(),
          },
        },
      ],
      tool_choice: { type: "function", function: { name: TOOL_NAME } },
    });

    const message = res.choices[0]?.message;
    if (message?.refusal) throw new Error(`Model declined: ${message.refusal}`);
    const call = message?.tool_calls?.find(
      (c) => c.type === "function" && c.function.name === TOOL_NAME,
    );
    if (!call || call.type !== "function")
      throw new Error("Model did not return structured output");
    const data = MealAnalysisSchema.parse(JSON.parse(call.function.arguments));

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
