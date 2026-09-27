import { NextResponse } from "next/server";
import { requireUserId, route } from "@/lib/api";
import { localDate } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { generateWeek } from "@/lib/services/workouts";
import { WeekPlanSchema } from "@/lib/training";

/** Build (or rebuild as a new version) this week's plan with the coach engine. */
export const POST = route(async () => {
  const userId = await requireUserId();
  const profile = await prisma.profile.findUnique({
    where: { userId },
    select: { timezone: true },
  });
  const row = await generateWeek(userId, localDate(profile?.timezone));
  return NextResponse.json(
    {
      id: row.id,
      weekStart: row.weekStart,
      version: row.version,
      plan: WeekPlanSchema.parse(row.plan),
    },
    { status: 201 },
  );
});
