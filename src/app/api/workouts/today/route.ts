import { NextResponse } from "next/server";
import { requireUserId, route } from "@/lib/api";
import { localDate } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { getTodayWorkout } from "@/lib/services/workouts";
import { EnergySchema } from "@/lib/validators";

/** GET /api/workouts/today?energy=great|ok|tired → today's session with daily adjustments. */
export const GET = route(async (req) => {
  const userId = await requireUserId();
  const energy = EnergySchema.catch("ok").parse(
    new URL(req.url).searchParams.get("energy") ?? "ok",
  );
  const profile = await prisma.profile.findUnique({
    where: { userId },
    select: { timezone: true },
  });
  return NextResponse.json(await getTodayWorkout(userId, localDate(profile?.timezone), energy));
});
