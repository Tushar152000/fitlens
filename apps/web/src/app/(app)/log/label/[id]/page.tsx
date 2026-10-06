import { notFound } from "next/navigation";
import { MEAL_TYPES, type MealType } from "@fitr8/domain/format";
import { ApiError, requireOnboardedViewer, serverApi } from "@/lib/server/api";
import type { LabelScanDto } from "@fitr8/contracts";
import { CheckLabel } from "./check-label";

export const metadata = { title: "Check label — FITR8" };

/** Design 7g: check the values the AI read, then save and add. */
export default async function CheckLabelPage({
  params,
  searchParams,
}: PageProps<"/log/label/[id]">) {
  await requireOnboardedViewer();
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  let scan: LabelScanDto;
  try {
    scan = await serverApi<LabelScanDto>(`/foods/label/${encodeURIComponent(id)}`);
  } catch (err) {
    if (err instanceof ApiError && (err.status === 404 || err.status === 400)) notFound();
    throw err;
  }
  const meal = typeof sp.meal === "string" ? sp.meal.toUpperCase() : "SNACK";
  return (
    <CheckLabel
      scanId={scan.id}
      mealType={MEAL_TYPES.includes(meal as MealType) ? (meal as MealType) : "SNACK"}
      initial={{
        name: scan.name,
        kcal: scan.per100g.kcal,
        protein: scan.per100g.protein,
        carbs: scan.per100g.carbs,
        fat: scan.per100g.fat,
        servingSizeG: scan.servingSizeG,
        servingLabel: scan.servingLabel,
      }}
    />
  );
}
