import { MEAL_TYPES, mealTypeForHour, type MealType } from "@/lib/format";
import { requireOnboardedViewer } from "@/lib/viewer";
import { BarcodeScreen } from "./barcode-screen";

export const metadata = { title: "Scan barcode — FitLens" };

/** Design 7c: scan a packaged food's barcode. Lookups never use a photo scan. */
export default async function BarcodePage({ searchParams }: PageProps<"/log/barcode">) {
  const { timezone } = await requireOnboardedViewer();
  const params = await searchParams;
  const meal = typeof params.meal === "string" ? params.meal.toUpperCase() : undefined;
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
  return <BarcodeScreen mealType={mealType} />;
}
