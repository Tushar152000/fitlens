import type { LabelRead, MealAnalysis } from "@fitr8/contracts";
import type { AiResult, FoodExtractor } from "./types.js";

const SAMPLE: MealAnalysis = {
  isFood: true,
  hiddenFatLikely: true,
  notes: "Mock result: set AI_PROVIDER=anthropic for real detection.",
  items: [
    {
      name: "roti",
      quantity: 2,
      unit: "piece",
      grams: 80,
      confidence: 0.93,
      isDrink: false,
      per100g: { kcal: 264, protein: 8.9, carbs: 46, fat: 5 },
    },
    {
      name: "dal tadka",
      quantity: 1,
      unit: "katori",
      grams: 150,
      confidence: 0.84,
      isDrink: false,
      per100g: { kcal: 120, protein: 6, carbs: 15, fat: 4 },
    },
    {
      name: "jeera rice",
      quantity: 1,
      unit: "katori",
      grams: 150,
      confidence: 0.71,
      isDrink: false,
      per100g: { kcal: 150, protein: 2.8, carbs: 28, fat: 3 },
    },
    {
      name: "mixed veg sabzi",
      quantity: 0.5,
      unit: "katori",
      grams: 75,
      confidence: 0.55,
      isDrink: false,
      per100g: { kcal: 90, protein: 2.5, carbs: 10, fat: 4.5 },
    },
  ],
};

/** Deterministic fake provider for local development and tests. */
export class MockExtractor implements FoodExtractor {
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
        // Rough generic home-food estimate; the food database replaces it when the name matches.
        const per100g = { kcal: 150, protein: 5, carbs: 20, fat: 5 };
        const isDrink = ["glass", "cup", "ml"].includes(unit);
        return { name, quantity, unit, grams, confidence: 0.6, isDrink, per100g };
      });
    return this.result({ isFood: items.length > 0, hiddenFatLikely: false, items });
  }

  async readNutritionLabel(): Promise<AiResult<LabelRead>> {
    return {
      data: {
        isLabel: true,
        productName: "Mock biscuits",
        per100g: { kcal: 480, protein: 7, carbs: 70, fat: 19, sugar: 25, sodiumMg: 300 },
        servingSizeG: 25,
        servingLabel: "3 biscuits (25 g)",
        confidence: 0.9,
      },
      usage: { provider: this.name, model: "mock", latencyMs: 5 },
    };
  }

  private async result(data: MealAnalysis): Promise<AiResult<MealAnalysis>> {
    return { data, usage: { provider: this.name, model: "mock", latencyMs: 5 } };
  }
}
