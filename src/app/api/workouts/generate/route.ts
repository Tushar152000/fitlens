import { NextResponse } from "next/server";
import { requireUserId, route } from "@/lib/api";

/** Weekly plan generation lands in week 4 of the roadmap (PRD section 8). */
export const POST = route(async () => {
  await requireUserId();
  return NextResponse.json({ error: "Workout plans are not built yet" }, { status: 501 });
});
