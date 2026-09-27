import { NextResponse } from "next/server";
import { requireUserId, route } from "@/lib/api";
import { localDate, parseDateOnly } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { getDay, loggingStreak } from "@/lib/services/dashboard";
import { presignRead } from "@/lib/storage/s3";

/** Screen 6 data: the day's targets and meals (with 1 h photo links), plus the logging streak. */
export const GET = route(async (req) => {
  const userId = await requireUserId();
  const dateParam = new URL(req.url).searchParams.get("date");
  const profile = await prisma.profile.findUnique({
    where: { userId },
    select: { timezone: true },
  });
  const today = localDate(profile?.timezone);
  const date = dateParam ? parseDateOnly(dateParam) : today;
  const [day, streak] = await Promise.all([getDay(userId, date), loggingStreak(userId, today)]);
  const meals = await Promise.all(
    day.meals.map(async (m) => ({
      ...m,
      aiRaw: undefined, // raw model output isn't needed on the dashboard
      photoUrl: m.photoKey ? await presignRead(m.photoKey, 3600).catch(() => null) : null,
    })),
  );
  return NextResponse.json({
    ...day,
    meals,
    streak,
    timezone: profile?.timezone ?? "Asia/Kolkata",
  });
});
