import Anthropic from "@anthropic-ai/sdk";
import { MealAnalysisSchema, mealAnalysisJsonSchema, type MealAnalysis } from "./schemas";
import { SYSTEM_PROMPT, photoUserPrompt, textUserPrompt, type MealContext } from "./prompts";
import type { AiProvider, AiResult } from "./types";

const TOOL_NAME = "record_meal";

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
    return this.call(this.visionModel, [
      { type: "image", source: { type: "url", url: imageUrl } },
      { type: "text", text: photoUserPrompt(context) },
    ]);
  }

  parseMealText({ text, context }: { text: string; context: MealContext }) {
    return this.call(this.textModel, [{ type: "text", text: textUserPrompt(text, context) }]);
  }

  /** Forces a tool call so the model must return JSON matching our schema. */
  private async call(
    model: string,
    content: Anthropic.ContentBlockParam[],
  ): Promise<AiResult<MealAnalysis>> {
    const started = Date.now();
    const res = await this.client.messages.create({
      model,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      tools: [
        {
          name: TOOL_NAME,
          description: "Record the foods detected in the meal",
          input_schema: mealAnalysisJsonSchema() as Anthropic.Tool.InputSchema,
        },
      ],
      tool_choice: { type: "tool", name: TOOL_NAME },
      messages: [{ role: "user", content }],
    });

    const block = res.content.find((b) => b.type === "tool_use");
    if (!block || block.type !== "tool_use")
      throw new Error("Model did not return structured output");
    const data = MealAnalysisSchema.parse(block.input);

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
