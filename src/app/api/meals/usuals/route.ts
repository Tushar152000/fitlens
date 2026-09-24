import { NextResponse } from "next/server";
import { requireUserId, route } from "@/lib/api";
import { getUsuals } from "@/lib/services/usuals";

/** Meals this user logs most often (design 7b "Your usuals"). */
export const GET = route(async () => {
  const userId = await requireUserId();
  return NextResponse.json({ usuals: await getUsuals(userId) });
});
