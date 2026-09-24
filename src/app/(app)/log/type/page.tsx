import { MEAL_TYPES, mealTypeForHour, type MealType } from "@/lib/format";
import { getUsuals } from "@/lib/services/usuals";
import { requireOnboardedViewer } from "@/lib/viewer";
import { TypeMealScreen } from "./type-meal-screen";

export const metadata = { title: "Type a meal — FitLens" };

/** Design 7b: type what you ate, or relog a usual with one tap. Typing never uses a photo scan. */
export default async function TypeMealPage({ searchParams }: PageProps<"/log/type">) {
  const { userId, timezone } = await requireOnboardedViewer();
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
  return <TypeMealScreen initialMealType={mealType} usuals={await getUsuals(userId)} />;
}
