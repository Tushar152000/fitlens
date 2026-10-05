import { redirect } from "next/navigation";
import { MEAL_TYPES, mealTypeForHour, type MealType } from "@fitr8/domain/format";
import { requireOnboardedViewer } from "@/lib/server/api";
import { CameraScreen } from "./camera-screen";

export const metadata = { title: "Log a meal — FITR8" };

/** Screen 7: camera → compress → signed upload → create meal → confirm. `?meal=DINNER` is optional. */
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
  if (params.mode === "text") redirect(`/log/type?meal=${mealType}`);
  return <CameraScreen initialMealType={mealType} />;
}
