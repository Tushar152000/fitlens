import { NextResponse } from "next/server";
import { HttpError, parseBody, requireUserId, route } from "@/lib/api";
import { prisma } from "@/lib/db";
import { confirmMeal } from "@/lib/services/meals";
import { presignRead } from "@/lib/storage/s3";
import { ConfirmMealSchema } from "@/lib/validators";

type Ctx = RouteContext<"/api/meals/[id]">;

async function ownedLog(id: string, userId: string) {
  const log = await prisma.mealLog.findFirst({ where: { id, userId }, include: { items: true } });
  if (!log) throw new HttpError(404, "Meal not found");
  return log;
}

/** Poll this while status is PENDING/ANALYZING. */
export const GET = route<Ctx>(async (_req, ctx) => {
  const userId = await requireUserId();
  const { id } = await ctx.params;
  const log = await ownedLog(id, userId);
  const photoUrl = log.photoKey ? await presignRead(log.photoKey, 300) : null;
  return NextResponse.json({ ...log, photoUrl });
});

/** Step 3: user confirms or edits the detected items. */
export const PUT = route<Ctx>(async (req, ctx) => {
  const userId = await requireUserId();
  const { id } = await ctx.params;
  const log = await ownedLog(id, userId);
  if (log.status === "PENDING" || log.status === "ANALYZING") {
    throw new HttpError(409, "Still analysing — try again in a moment");
  }
  const { items, note } = await parseBody(req, ConfirmMealSchema);
  return NextResponse.json(await confirmMeal(log.id, items, note));
});

export const DELETE = route<Ctx>(async (_req, ctx) => {
  const userId = await requireUserId();
  const { id } = await ctx.params;
  await ownedLog(id, userId);
  await prisma.mealLog.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
});
