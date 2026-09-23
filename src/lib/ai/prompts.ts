export interface MealContext {
  mealType: "BREAKFAST" | "LUNCH" | "DINNER" | "SNACK";
  dietType: "VEG" | "NON_VEG" | "EGGETARIAN" | "VEGAN";
  region?: string;
  frequentFoods?: string[];
}

export const SYSTEM_PROMPT = `You are a nutrition assistant for an Indian fitness app.
Identify every distinct food item and estimate its portion.
Rules:
- Prefer Indian household units: roti/paratha/idli/dosa = piece, dal/sabzi/curd = katori (~150 g), rice = katori or cup.
- Give grams for every item. Be realistic, not generous or stingy.
- Split thalis into their parts. Treat a single mixed dish (biryani, poha, upma) as one item.
- Confidence reflects how sure you are about both the food and the portion.
- If the image is not food, set isFood=false and return no items.
- Always answer by calling the record_meal tool.`;

export function photoUserPrompt(ctx: MealContext): string {
  return [
    `Meal type: ${ctx.mealType}. Diet: ${ctx.dietType}. Region: ${ctx.region ?? "India"}.`,
    ctx.frequentFoods?.length ? `Foods this user often eats: ${ctx.frequentFoods.join(", ")}.` : "",
    "List each item with quantity, unit, grams and confidence.",
  ]
    .filter(Boolean)
    .join("\n");
}

export function textUserPrompt(text: string, ctx: MealContext): string {
  return [
    `The user typed what they ate for ${ctx.mealType.toLowerCase()} (diet: ${ctx.dietType}):`,
    `"""${text}"""`,
    "Convert it into items with quantity, unit, grams and confidence. Assume typical Indian home portions where unstated.",
  ].join("\n");
}
