import { z } from "zod";

export const Per100gSchema = z.object({
  kcal: z.number().nonnegative(),
  protein: z.number().nonnegative(),
  carbs: z.number().nonnegative(),
  fat: z.number().nonnegative(),
});

export const DetectedItemSchema = z.object({
  name: z
    .string()
    .min(1)
    .describe("Common name, lowercase, e.g. 'roti', 'dal tadka', 'jeera rice'"),
  quantity: z.number().positive(),
  unit: z
    .string()
    .describe("Household unit: piece, katori, cup, bowl, plate, tbsp, tsp, glass, or g"),
  grams: z.number().positive().describe("Best estimate of total grams for this item"),
  confidence: z.number().min(0).max(1),
  per100g: Per100gSchema.optional().describe(
    "Your estimate of nutrition per 100 g, used only if the food is not in our database",
  ),
});

export const MealAnalysisSchema = z.object({
  isFood: z.boolean().describe("false if the image does not show food"),
  items: z.array(DetectedItemSchema),
  hiddenFatLikely: z
    .boolean()
    .describe("true if ghee/oil/butter is likely added and not visible (curries, parathas)"),
  notes: z.string().optional(),
});

export type DetectedItem = z.infer<typeof DetectedItemSchema>;
export type MealAnalysis = z.infer<typeof MealAnalysisSchema>;

/** JSON Schema for the model's structured output (tool input). */
export function mealAnalysisJsonSchema(): Record<string, unknown> {
  const schema = z.toJSONSchema(MealAnalysisSchema) as Record<string, unknown>;
  delete schema.$schema;
  return schema;
}
