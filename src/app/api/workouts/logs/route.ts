import { NextResponse } from "next/server";
import { parseBody, requireUserId, route } from "@/lib/api";
import { localDate } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { logExercise } from "@/lib/services/workouts";
import { WorkoutLogSchema } from "@/lib/validators";

/** Save one exercise's sets for today; returns the next target for that exercise. */
export const POST = route(async (req) => {
  const userId = await requireUserId();
  const input = await parseBody(req, WorkoutLogSchema);
  const profile = await prisma.profile.findUnique({
    where: { userId },
    select: { timezone: true },
  });
  return NextResponse.json(await logExercise(userId, input, localDate(profile?.timezone)), {
    status: 201,
  });
});
