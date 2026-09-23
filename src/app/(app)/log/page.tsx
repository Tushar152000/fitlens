import { MEAL_TYPES, mealTypeForHour, type MealType } from "@/lib/format";
import { requireOnboardedViewer } from "@/lib/viewer";
import { CameraScreen } from "./camera-screen";

export const metadata = { title: "Log a meal — FitLens" };

/** Screen 7: camera → compress → signed upload → create meal → confirm. `?meal=DINNER&mode=text` are optional. */
export default async function LogPage({ searchParams }: PageProps<"/log">) {
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
  return <CameraScreen initialMealType={mealType} startInTextMode={params.mode === "text"} />;
}
