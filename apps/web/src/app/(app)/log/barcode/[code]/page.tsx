import { MEAL_TYPES, mealTypeForHour, type MealType } from "@fitlens/domain/format";
import { ApiError, requireOnboardedViewer, serverApi } from "@/lib/server/api";
import type { BarcodeProductDto } from "@fitlens/contracts";
import { NotFoundScreen, ProductScreen } from "./product-screens";

export const metadata = { title: "Product — FitLens" };

/** Design 7d (found) and 7e (not found) for one barcode. */
export default async function ProductPage({
  params,
  searchParams,
}: PageProps<"/log/barcode/[code]">) {
  const { timezone } = await requireOnboardedViewer();
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

  let result: BarcodeProductDto;
  try {
    result = await serverApi<BarcodeProductDto>(`/foods/barcode/${encodeURIComponent(code)}`);
  } catch (err) {
    if (!(err instanceof ApiError)) throw err;
    if (err.status === 400) {
      return <NotFoundScreen code={code} mealType={mealType} reason="invalid" />;
    }
    if (err.status === 404) {
      const details = err.details as { code?: string } | undefined;
      return <NotFoundScreen code={details?.code ?? code} mealType={mealType} reason="unknown" />;
    }
    return <NotFoundScreen code={code} mealType={mealType} reason="unreachable" />;
  }
  const { food } = result;
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
