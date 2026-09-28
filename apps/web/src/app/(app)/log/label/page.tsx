import { MEAL_TYPES, mealTypeForHour, type MealType } from "@fitlens/domain/format";
import { requireOnboardedViewer } from "@/lib/server/api";
import { LabelCamera } from "./label-camera";

export const metadata = { title: "Photograph label — FitLens" };

/** Design 7f: dark camera with a tall frame for the nutrition table. */
export default async function LabelPage({ searchParams }: PageProps<"/log/label">) {
  const { timezone } = await requireOnboardedViewer();
  const sp = await searchParams;
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
  return (
    <LabelCamera
      mealType={mealType}
      barcode={typeof sp.barcode === "string" ? sp.barcode : undefined}
      name={typeof sp.name === "string" ? sp.name : undefined}
    />
  );
}
