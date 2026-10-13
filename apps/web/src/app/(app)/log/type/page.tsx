import { MEAL_TYPES, mealTypeForHour, type MealType } from "@fitr8/domain/format";
import { requireOnboardedViewer, serverApiOrNull } from "@/lib/server/api";
import type { UsualsDto } from "@fitr8/contracts";
import { TypeMealScreen } from "./type-meal-screen";

export const metadata = { title: "Type a meal — FITR8" };

/** Design 7b: type what you ate, or relog a usual with one tap. Typing never uses a photo scan. */
export default async function TypeMealPage({ searchParams }: PageProps<"/log/type">) {
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
  // Usuals are a shortcut: if they can't load, typing still works.
  const usuals = (await serverApiOrNull<UsualsDto>("/meals/usuals"))?.usuals ?? [];
  return <TypeMealScreen initialMealType={mealType} usuals={usuals} />;
}
