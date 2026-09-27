import { NextResponse } from "next/server";
import { requireUserId, route } from "@/lib/api";
import { prisma } from "@/lib/db";

/** Who is signed in, and whether onboarding is done. The app's first call after sign-in. */
export const GET = route(async () => {
  const userId = await requireUserId();
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { id: true, name: true, email: true, image: true, profile: true },
  });
  const { profile, ...rest } = user;
  return NextResponse.json({
    ...rest,
    onboarded: Boolean(profile?.onboardedAt),
    profile,
  });
});
