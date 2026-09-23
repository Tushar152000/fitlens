import type { MealAnalysis } from "./schemas";
import type { AiProvider, AiResult } from "./types";

const SAMPLE: MealAnalysis = {
  isFood: true,
  hiddenFatLikely: true,
  notes: "Mock result: set AI_PROVIDER=anthropic for real detection.",
  items: [
    { name: "roti", quantity: 2, unit: "piece", grams: 80, confidence: 0.93 },
    { name: "dal tadka", quantity: 1, unit: "katori", grams: 150, confidence: 0.84 },
    { name: "jeera rice", quantity: 1, unit: "katori", grams: 150, confidence: 0.71 },
    { name: "mixed veg sabzi", quantity: 0.5, unit: "katori", grams: 75, confidence: 0.55 },
  ],
};

/** Deterministic fake provider for local development and tests. */
export class MockProvider implements AiProvider {
  readonly name = "mock";

  async analyzeMealPhoto(): Promise<AiResult<MealAnalysis>> {
    return this.result(SAMPLE);
  }

  async parseMealText({ text }: { text: string }): Promise<AiResult<MealAnalysis>> {
    // Very small parser: "2 roti, 1 katori dal" → items. Good enough for UI work.
    const items = text
      .split(/,|\band\b|\n/i)
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const m = part.match(
          /^(\d+(?:\.\d+)?)\s*(piece|pieces|katori|cup|bowl|plate|glass|g)?\s*(.+)$/i,
        );
        const quantity = m ? Number(m[1]) : 1;
        const unit = (m?.[2] ?? "piece").toLowerCase().replace(/s$/, "");
        const name = (m?.[3] ?? part).toLowerCase();
        const grams =
          unit === "g" ? quantity : quantity * (unit === "katori" || unit === "bowl" ? 150 : 50);
        return { name, quantity, unit, grams, confidence: 0.6 };
      });
    return this.result({ isFood: items.length > 0, hiddenFatLikely: false, items });
  }

  private async result(data: MealAnalysis): Promise<AiResult<MealAnalysis>> {
    return { data, usage: { provider: this.name, model: "mock", latencyMs: 5 } };
  }
}
