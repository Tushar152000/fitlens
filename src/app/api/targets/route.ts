import { NextResponse } from "next/server";
import { HttpError, requireUserId, route } from "@/lib/api";
import { currentTarget } from "@/lib/services/targets";

export const GET = route(async () => {
  const userId = await requireUserId();
  const target = await currentTarget(userId);
  if (!target) throw new HttpError(404, "Finish onboarding first");
  return NextResponse.json({ target });
});
