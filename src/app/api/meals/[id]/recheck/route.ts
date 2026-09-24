import { NextResponse } from "next/server";
import { HttpError, parseBody, requireUserId, route } from "@/lib/api";
import { prisma } from "@/lib/db";
import { getMealQueue, queueEnabled } from "@/lib/queue";
import { analyzeMealLog, assertCanScanPhoto, assertWithinTextCap } from "@/lib/services/meals";
import { RecheckSchema } from "@/lib/validators";

type Ctx = RouteContext<"/api/meals/[id]/recheck">;

/**
 * Run the AI again on a meal, optionally with the user's details ("small cup, 2 sachets
 * sugar"). The meal goes back to PENDING; poll GET /api/meals/[id] as after a new upload.
 */
export const POST = route<Ctx>(async (req, ctx) => {
  const userId = await requireUserId();
  const { id } = await ctx.params;
  const { note } = await parseBody(req, RecheckSchema);

  const log = await prisma.mealLog.findFirst({ where: { id, userId } });
  if (!log) throw new HttpError(404, "Meal not found");
  if (log.status === "PENDING" || log.status === "ANALYZING") {
    throw new HttpError(409, "Still analysing — try again in a moment");
  }
  if (log.source === "PHOTO" && log.photoKey) await assertCanScanPhoto(userId);
  else await assertWithinTextCap(userId);

  await prisma.mealLog.update({
    where: { id },
    data: { ...(note ? { note } : {}), status: "PENDING", error: null, confirmedAt: null },
  });

  if (queueEnabled()) {
    // A fresh job id: BullMQ ignores a job whose id it has already seen.
    await getMealQueue().add("analyze", { mealLogId: id }, { jobId: `${id}-${Date.now()}` });
    return NextResponse.json({ id, status: "PENDING" }, { status: 202 });
  }
  await analyzeMealLog(id).catch(() => undefined); // failure is recorded on the log
  return NextResponse.json({ id, status: "DONE" });
});
