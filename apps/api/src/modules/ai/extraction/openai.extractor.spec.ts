import type OpenAI from "openai";
import { describe, expect, it } from "vitest";
import { OpenAiExtractor } from "./openai.extractor.js";
import type { MealContext } from "./types.js";

const context: MealContext = { mealType: "LUNCH", dietType: "VEG" };

function fakeOpenAi(reply: Partial<OpenAI.Responses.Response>) {
  const requests: Record<string, unknown>[] = [];
  const client = {
    responses: {
      async create(params: Record<string, unknown>) {
        requests.push(params);
        return {
          model: "gpt-test",
          incomplete_details: null,
          output_text: "",
          usage: { input_tokens: 50, output_tokens: 20 },
          ...reply,
        };
      },
    },
  } as unknown as OpenAI;
  return { extractor: new OpenAiExtractor(client, "gpt-test"), requests };
}

describe("OpenAiExtractor", () => {
  it("sends the image with a JSON schema format and validates the reply", async () => {
    const analysis = { isFood: true, items: [], hiddenFatLikely: false };
    const { extractor, requests } = fakeOpenAi({ output_text: JSON.stringify(analysis) });
    const result = await extractor.analyzeMealPhoto({
      image: { data: Buffer.from("img"), mediaType: "image/jpeg" },
      context,
    });

    expect(result.usage).toMatchObject({ provider: "openai", model: "gpt-test", tokensIn: 50 });
    expect(result.data).toMatchObject(analysis);
    const request = requests[0] as {
      input: { content: { type: string; image_url?: string }[] }[];
      text: { format: { type: string; name: string } };
    };
    expect(request.text.format).toMatchObject({ type: "json_schema", name: "meal_analysis" });
    expect(request.input[0]!.content[0]).toMatchObject({
      type: "input_image",
      image_url: `data:image/jpeg;base64,${Buffer.from("img").toString("base64")}`,
    });
  });

  it("rejects replies that don't match the schema", async () => {
    const { extractor } = fakeOpenAi({ output_text: '{"nope":true}' });
    await expect(extractor.parseMealText({ text: "2 roti", context })).rejects.toThrow(
      "Model did not return structured output",
    );
  });

  it("reports cut-off output", async () => {
    const { extractor } = fakeOpenAi({ incomplete_details: { reason: "max_output_tokens" } });
    await expect(extractor.parseMealText({ text: "2 roti", context })).rejects.toThrow(
      "Model output was cut off",
    );
  });
});
