import { notFound } from "next/navigation";
import type { LabelRead } from "@/lib/ai";
import { MEAL_TYPES, type MealType } from "@/lib/format";
import { getLabelScan } from "@/lib/services/labels";
import { requireOnboardedViewer } from "@/lib/viewer";
import { CheckLabel } from "./check-label";

export const metadata = { title: "Check label — FitLens" };

/** Design 7g: check the values the AI read, then save and add. */
export default async function CheckLabelPage({
  params,
  searchParams,
}: PageProps<"/log/label/[id]">) {
  const { userId } = await requireOnboardedViewer();
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const scan = await getLabelScan(userId, id);
  if (!scan) notFound();
  const meal = typeof sp.meal === "string" ? sp.meal.toUpperCase() : "SNACK";
  const read = scan.extracted as unknown as LabelRead;
  return (
    <CheckLabel
      scanId={scan.id}
      mealType={MEAL_TYPES.includes(meal as MealType) ? (meal as MealType) : "SNACK"}
      initial={{
        name: scan.name ?? read.productName ?? "",
        kcal: read.per100g.kcal,
        protein: read.per100g.protein,
        carbs: read.per100g.carbs,
        fat: read.per100g.fat,
        servingSizeG: read.servingSizeG ?? null,
        servingLabel: read.servingLabel ?? null,
      }}
    />
  );
}
