import { NextResponse } from "next/server";
import { HttpError, parseBody, requireUserId, route } from "@/lib/api";
import { localDate, parseDateOnly } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { getMealQueue, queueEnabled } from "@/lib/queue";
import { analyzeMealLog, assertCanScanPhoto, assertWithinTextCap } from "@/lib/services/meals";
import { CreateMealSchema } from "@/lib/validators";

/**
 * Step 2: create a meal log from a photo key or text, then analyse it (queued, or inline without Redis).
 * MANUAL creates an empty READY log with no AI call, for the user to fill in.
 */
export const POST = route(async (req) => {
  const userId = await requireUserId();
  const input = await parseBody(req, CreateMealSchema);

  if (input.source === "PHOTO" && !input.photoKey.startsWith(`meals/${userId}/`)) {
    throw new HttpError(403, "Photo does not belong to you");
  }
  // Photos use a daily scan; typed meals are free (design 9c).
  if (input.source === "PHOTO") await assertCanScanPhoto(userId);
  if (input.source === "TEXT") await assertWithinTextCap(userId);

  const profile = await prisma.profile.findUnique({
    where: { userId },
    select: { timezone: true },
  });
  const date = input.date ? parseDateOnly(input.date) : localDate(profile?.timezone);

  if (input.source === "MANUAL") {
    const log = await prisma.mealLog.create({
      data: { userId, date, mealType: input.mealType, source: "TEXT", status: "READY" },
      include: { items: true },
    });
    return NextResponse.json(log, { status: 201 });
  }

  const log = await prisma.mealLog.create({
    data: {
      userId,
      date,
      mealType: input.mealType,
      source: input.source,
      photoKey: input.source === "PHOTO" ? input.photoKey : null,
      inputText: input.source === "TEXT" ? input.text : null,
    },
  });

  if (queueEnabled()) {
    await getMealQueue().add("analyze", { mealLogId: log.id }, { jobId: log.id });
    return NextResponse.json({ id: log.id, status: "PENDING" }, { status: 202 });
  }

  await analyzeMealLog(log.id).catch(() => undefined); // failure is recorded on the log
  const result = await prisma.mealLog.findUnique({
    where: { id: log.id },
    include: { items: true },
  });
  return NextResponse.json(result, { status: 201 });
});

export const GET = route(async (req) => {
  const userId = await requireUserId();
  const dateParam = new URL(req.url).searchParams.get("date");
  const where = dateParam ? { userId, date: parseDateOnly(dateParam) } : { userId };
  const meals = await prisma.mealLog.findMany({
    where,
    include: { items: true },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return NextResponse.json({ meals });
});
