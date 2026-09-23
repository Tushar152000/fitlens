import { NextResponse } from "next/server";
import { HttpError, requireUserId, route } from "@/lib/api";
import { localDate } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { currentTarget } from "@/lib/services/targets";

export const GET = route(async () => {
  const userId = await requireUserId();
  const profile = await prisma.profile.findUnique({
    where: { userId },
    select: { timezone: true },
  });
  // Targets are keyed by the user's local date, which can be ahead of UTC.
  const target = await currentTarget(userId, localDate(profile?.timezone));
  if (!target) throw new HttpError(404, "Finish onboarding first");
  return NextResponse.json({ target });
});
