import { NextResponse } from "next/server";
import { HttpError, parseBody, requireUserId, route } from "@/lib/api";
import { relogMeal } from "@/lib/services/usuals";
import { RelogSchema } from "@/lib/validators";

/** One-tap relog of a usual: copies a confirmed meal into today. No AI call, no scan used. */
export const POST = route(async (req) => {
  const userId = await requireUserId();
  const { mealId, mealType } = await parseBody(req, RelogSchema);
  const log = await relogMeal(userId, mealId, mealType);
  if (!log) throw new HttpError(404, "Meal not found");
  return NextResponse.json({ id: log.id }, { status: 201 });
});
