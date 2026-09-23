import { NextResponse } from "next/server";
import { parseBody, requireUserId, route } from "@/lib/api";
import { localDate, parseDateOnly } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { bodyFatNavy } from "@/lib/nutrition";
import { CheckinSchema } from "@/lib/validators";

/**
 * Logs a weigh-in. The weekly adjustment rules (PRD section 8) are added in week 5;
 * for now this stores the metric so trends can be charted.
 */
export const POST = route(async (req) => {
  const userId = await requireUserId();
  const input = await parseBody(req, CheckinSchema);
  const profile = await prisma.profile.findUnique({ where: { userId } });
  const date = input.date ? parseDateOnly(input.date) : localDate(profile?.timezone);

  const bodyFatPct =
    profile && input.waistCm && input.neckCm
      ? bodyFatNavy({
          sex: profile.sex,
          heightCm: profile.heightCm,
          waistCm: input.waistCm,
          neckCm: input.neckCm,
          hipCm: input.hipCm,
        })
      : null;

  const data = {
    weightKg: input.weightKg,
    waistCm: input.waistCm,
    neckCm: input.neckCm,
    hipCm: input.hipCm,
    bodyFatPct,
  };
  const metric = await prisma.bodyMetric.upsert({
    where: { userId_date: { userId, date } },
    create: { userId, date, ...data },
    update: data,
  });
  return NextResponse.json({ metric }, { status: 201 });
});

export const GET = route(async () => {
  const userId = await requireUserId();
  const metrics = await prisma.bodyMetric.findMany({
    where: { userId },
    orderBy: { date: "asc" },
    take: 120,
  });
  return NextResponse.json({ metrics });
});
