import { NextResponse } from "next/server";
import { requireUserId, route } from "@/lib/api";
import { scanUsage } from "@/lib/services/meals";

/** Photo scans used today, the daily limit and when it resets (local midnight). */
export const GET = route(async () => {
  const userId = await requireUserId();
  return NextResponse.json(await scanUsage(userId));
});
