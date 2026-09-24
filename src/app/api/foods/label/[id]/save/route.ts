import { NextResponse } from "next/server";
import { parseBody, requireUserId, route } from "@/lib/api";
import { saveLabelFood } from "@/lib/services/labels";
import { LabelSaveSchema } from "@/lib/validators";

type Ctx = RouteContext<"/api/foods/label/[id]/save">;

/** Design 7g "Save and add": creates the food from checked values and logs it. */
export const POST = route<Ctx>(async (req, ctx) => {
  const userId = await requireUserId();
  const { id } = await ctx.params;
  const input = await parseBody(req, LabelSaveSchema);
  const log = await saveLabelFood(userId, id, input);
  return NextResponse.json({ id: log.id }, { status: 201 });
});
