import { MEAL_TYPES, mealTypeForHour, type MealType } from "@/lib/format";
import { getProduct, lookupBarcode } from "@/lib/services/barcode";
import { requireOnboardedViewer } from "@/lib/viewer";
import { NotFoundScreen, ProductScreen } from "./product-screens";

export const metadata = { title: "Product — FitLens" };

/** Design 7d (found) and 7e (not found) for one barcode. */
export default async function ProductPage({
  params,
  searchParams,
}: PageProps<"/log/barcode/[code]">) {
  const { userId, timezone } = await requireOnboardedViewer();
  const [{ code }, sp] = await Promise.all([params, searchParams]);
  const meal = typeof sp.meal === "string" ? sp.meal.toUpperCase() : undefined;
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      hour: "numeric",
      hourCycle: "h23",
      timeZone: timezone,
    }).format(new Date()),
  );
  const mealType = MEAL_TYPES.includes(meal as MealType)
    ? (meal as MealType)
    : mealTypeForHour(hour);

  let result: Awaited<ReturnType<typeof lookupBarcode>>;
  try {
    result = await lookupBarcode(code, userId);
  } catch {
    return <NotFoundScreen code={code} mealType={mealType} reason="unreachable" />;
  }
  if (result.status !== "found") {
    return (
      <NotFoundScreen
        code={result.status === "not_found" ? result.code : code}
        mealType={mealType}
        reason={result.status === "invalid" ? "invalid" : "unknown"}
      />
    );
  }
  const food = await getProduct(result.foodId);
  if (!food) return <NotFoundScreen code={code} mealType={mealType} reason="unknown" />;
  return (
    <ProductScreen
      mealType={mealType}
      code={result.code}
      food={{
        id: food.id,
        name: food.name,
        brand: food.brand,
        imageUrl: food.imageUrl,
        servingSizeG: food.servingSizeG,
        servingLabel: food.servingLabel,
        isLiquid: food.isLiquid,
        source: food.source,
        verified: food.verified,
        per100g: {
          kcal: food.kcalPer100g,
          protein: food.proteinPer100g,
          carbs: food.carbsPer100g,
          fat: food.fatPer100g,
          sugar: food.sugarPer100g,
          sodiumMg: food.sodiumMgPer100g,
        },
      }}
    />
  );
}
