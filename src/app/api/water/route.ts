import { NextResponse } from "next/server";
import { parseBody, requireUserId, route } from "@/lib/api";
import { localDate } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { addWater, getWater } from "@/lib/services/water";
import { WaterAddSchema } from "@/lib/validators";

async function today(userId: string) {
  const profile = await prisma.profile.findUnique({ where: { userId }, select: { timezone: true } });
  return localDate(profile?.timezone);
}

/** Today's water target (with its reason), amount drunk and the entries (for undo). */
export const GET = route(async () => {
  const userId = await requireUserId();
  return NextResponse.json(await getWater(userId, await today(userId)));
});

/** Log a glass or bottle; returns the updated day. */
export const POST = route(async (req) => {
  const userId = await requireUserId();
  const { ml } = await parseBody(req, WaterAddSchema);
  const date = await today(userId);
  await addWater(userId, date, ml);
  return NextResponse.json(await getWater(userId, date), { status: 201 });
});
