import { NextResponse } from "next/server";
import { requireUserId, route } from "@/lib/api";
import { localDate, parseDateOnly } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { getDay } from "@/lib/services/dashboard";

export const GET = route(async (req) => {
  const userId = await requireUserId();
  const dateParam = new URL(req.url).searchParams.get("date");
  const profile = await prisma.profile.findUnique({
    where: { userId },
    select: { timezone: true },
  });
  const date = dateParam ? parseDateOnly(dateParam) : localDate(profile?.timezone);
  return NextResponse.json(await getDay(userId, date));
});
