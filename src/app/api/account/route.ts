import { NextResponse } from "next/server";
import { requireUserId, route } from "@/lib/api";
import { prisma } from "@/lib/db";

/**
 * Design 13 "Delete account": removes the user and everything tied to it (profile, meals,
 * weigh-ins, sessions — all cascade). Meal photos in storage are left for a cleanup job.
 */
export const DELETE = route(async () => {
  const userId = await requireUserId();
  await prisma.user.delete({ where: { id: userId } });
  return new NextResponse(null, { status: 204 });
});
