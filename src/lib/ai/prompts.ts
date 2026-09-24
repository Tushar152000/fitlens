export interface MealContext {
  mealType: "BREAKFAST" | "LUNCH" | "DINNER" | "SNACK";
  dietType: "VEG" | "NON_VEG" | "EGGETARIAN" | "VEGAN";
  region?: string;
  frequentFoods?: string[];
  /** The user's own details about this meal ("small cup, 2 sachets sugar"). Overrides guesses. */
  userNote?: string;
}

const noteLine = (ctx: MealContext) =>
  ctx.userNote
    ? `The user added these details about the meal. Trust them over what you see or assume, and add any items they mention:\n"""${ctx.userNote}"""`
    : "";

export const SYSTEM_PROMPT = `You are a nutrition assistant for an Indian fitness app.
Identify every distinct food item and estimate its portion.
Rules:
- Prefer Indian household units: roti/paratha/idli/dosa = piece, dal/sabzi/curd = katori (~150 g), rice = katori or cup.
- Give grams for every item. Be realistic, not generous or stingy.
- Split thalis into their parts. Treat a single mixed dish (biryani, poha, upma) as one item.
- Drinks count as food: chai, coffee, milk, lassi, buttermilk, juice, soft drinks, smoothies and shakes (including protein shakes in a shaker bottle). Use glass, cup, can, bottle or ml, and give grams (1 ml ≈ 1 g).
- If you can see food or a drink but can't tell exactly what it is (a cloudy shake, a covered bowl), give your best guess with low confidence (below 0.5) and say what you assumed in notes, so the user can correct it.
- Confidence reflects how sure you are about both the food and the portion.
- Set isFood=false and return no items only when there is no food or drink in the image at all.
- Always answer by calling the record_meal tool.`;

export function photoUserPrompt(ctx: MealContext): string {
  return [
    `Meal type: ${ctx.mealType}. Diet: ${ctx.dietType}. Region: ${ctx.region ?? "India"}.`,
    ctx.frequentFoods?.length ? `Foods this user often eats: ${ctx.frequentFoods.join(", ")}.` : "",
    noteLine(ctx),
    "List each item with quantity, unit, grams and confidence.",
  ]
    .filter(Boolean)
    .join("\n");
}

export function textUserPrompt(text: string, ctx: MealContext): string {
  return [
    `The user typed what they ate for ${ctx.mealType.toLowerCase()} (diet: ${ctx.dietType}):`,
    `"""${text}"""`,
    noteLine(ctx),
    'Convert it into items with quantity, unit, grams and confidence. Keep the user\'s own unit and count when they give one ("2 sachets sugar" → quantity 2, unit sachet). Assume typical Indian home portions where unstated.',
  ]
    .filter(Boolean)
    .join("\n");
}

export const LABEL_SYSTEM_PROMPT = `You read nutrition-facts tables on packaged foods for a fitness app.
Rules:
- Report values per 100 g (or per 100 ml for drinks). If the table only has a per-serving column, convert it using the serving size.
- Energy in kcal. If only kJ is printed, divide by 4.184.
- Carbohydrates means total carbohydrate. Sodium in mg (salt in g × 400 = sodium mg).
- Copy numbers exactly as printed; don't estimate values that aren't on the label.
- If the photo doesn't show a nutrition table, set isLabel=false.
- Always answer by calling the record_label tool.`;
