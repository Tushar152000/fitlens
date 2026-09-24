import { NextResponse } from "next/server";
import { HttpError, parseBody, requireUserId, route } from "@/lib/api";
import { prisma } from "@/lib/db";
import { RemindersSchema } from "@/lib/validators";

/** Save the design-13 reminder switches. */
export const PATCH = route(async (req) => {
  const userId = await requireUserId();
  const { lunch, dinner } = await parseBody(req, RemindersSchema);
  const profile = await prisma.profile.findUnique({ where: { userId }, select: { userId: true } });
  if (!profile) throw new HttpError(404, "Finish onboarding first");
  const updated = await prisma.profile.update({
    where: { userId },
    data: {
      ...(lunch !== undefined ? { remindLunch: lunch } : {}),
      ...(dinner !== undefined ? { remindDinner: dinner } : {}),
    },
    select: { remindLunch: true, remindDinner: true },
  });
  return NextResponse.json(updated);
});
