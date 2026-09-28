import { NextResponse } from "next/server";
import { requireUserId, route } from "@/lib/api";
import { deleteWater } from "@/lib/services/water";

type Ctx = RouteContext<"/api/water/[id]">;

/** Undo one water entry. */
export const DELETE = route<Ctx>(async (_req, ctx) => {
  const userId = await requireUserId();
  const { id } = await ctx.params;
  await deleteWater(userId, id);
  return new NextResponse(null, { status: 204 });
});
