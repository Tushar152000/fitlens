import { NextResponse } from "next/server";
import { requireUserId, route } from "@/lib/api";
import { localDate } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { getProgress } from "@/lib/services/progress";

/** Screen 11 data: weigh-in trend (7-day averages) vs plan, and the last 7 days' stats. */
export const GET = route(async () => {
  const userId = await requireUserId();
  const profile = await prisma.profile.findUnique({ where: { userId }, select: { timezone: true } });
  return NextResponse.json(await getProgress(userId, localDate(profile?.timezone)));
});
