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
    .describe(
      "Household unit: piece, katori, cup, bowl, plate, tbsp, tsp, glass, can, bottle, scoop, sachet, cube, ml, or g. Keep the unit the user wrote.",
    ),
  grams: z.number().positive().describe("Best estimate of total grams for this item"),
  confidence: z.number().min(0).max(1),
  isDrink: z.boolean().describe("true for drinks (tea, coffee, milk, juice, shakes, soft drinks)"),
  // Required so an item never lands at 0 kcal; our food database overrides it when the food matches.
  per100g: Per100gSchema.describe(
    "Your estimate of nutrition per 100 g (kcal, protein, carbs, fat in grams). Always include it.",
  ),
});

export const MealAnalysisSchema = z.object({
  isFood: z.boolean().describe("false only if the image shows no food or drink at all"),
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

/** Design 7f/7g: values read from a nutrition-facts label, always per 100 g. */
export const LabelReadSchema = z.object({
  isLabel: z.boolean().describe("false if the photo does not show a nutrition table"),
  productName: z.string().optional().describe("Product name if visible on the pack"),
  per100g: z
    .object({
      kcal: z.number().nonnegative(),
      protein: z.number().nonnegative(),
      carbs: z.number().nonnegative(),
      fat: z.number().nonnegative(),
      sugar: z.number().nonnegative().optional(),
      sodiumMg: z.number().nonnegative().optional(),
    })
    .describe(
      "Per 100 g (or 100 ml). Convert from per-serving values if that is all the label shows.",
    ),
  servingSizeG: z
    .number()
    .positive()
    .optional()
    .describe("Serving size in grams (or ml) if stated"),
  servingLabel: z.string().optional().describe("Serving as printed, e.g. '3 biscuits (25 g)'"),
  confidence: z.number().min(0).max(1),
});

export type LabelRead = z.infer<typeof LabelReadSchema>;

export function labelReadJsonSchema(): Record<string, unknown> {
  const schema = z.toJSONSchema(LabelReadSchema) as Record<string, unknown>;
  delete schema.$schema;
  return schema;
}
