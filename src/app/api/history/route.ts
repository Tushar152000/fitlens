import { NextResponse } from "next/server";
import { requireUserId, route } from "@/lib/api";
import { localDate } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { getHistory } from "@/lib/services/history";

/** GET /api/history?days=7|30 — daily totals, targets and confirmed meals (design 12). */
export const GET = route(async (req) => {
  const userId = await requireUserId();
  const days = new URL(req.url).searchParams.get("days") === "30" ? 30 : 7;
  const profile = await prisma.profile.findUnique({
    where: { userId },
    select: { timezone: true },
  });
  return NextResponse.json(await getHistory(userId, days, localDate(profile?.timezone)));
});
