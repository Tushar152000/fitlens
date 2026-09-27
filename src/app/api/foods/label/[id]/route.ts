import { NextResponse } from "next/server";
import { HttpError, requireUserId, route } from "@/lib/api";
import type { LabelRead } from "@/lib/ai";
import { getLabelScan } from "@/lib/services/labels";

type Ctx = RouteContext<"/api/foods/label/[id]">;

/** Design 7g data: the values the AI read from a label photo, for the user to check. */
export const GET = route<Ctx>(async (_req, ctx) => {
  const userId = await requireUserId();
  const { id } = await ctx.params;
  const scan = await getLabelScan(userId, id);
  if (!scan) throw new HttpError(404, "Label scan not found");
  const read = scan.extracted as unknown as LabelRead;
  return NextResponse.json({
    id: scan.id,
    name: scan.name ?? read.productName ?? "",
    per100g: read.per100g,
    servingSizeG: read.servingSizeG ?? null,
    servingLabel: read.servingLabel ?? null,
  });
});
