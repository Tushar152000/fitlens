import { NextResponse } from "next/server";
import { parseBody, requireUserId, route } from "@/lib/api";
import { scanLabel } from "@/lib/services/labels";
import { LabelScanSchema } from "@/lib/validators";

/** AI calls run inline when there's no Redis worker (e.g. on Vercel). */
export const maxDuration = 60;

/** Read a nutrition-label photo (design 7f). Uses 1 photo scan. Returns the scan id for 7g. */
export const POST = route(async (req) => {
  const userId = await requireUserId();
  const input = await parseBody(req, LabelScanSchema);
  const scan = await scanLabel(userId, input);
  return NextResponse.json({ id: scan.id }, { status: 201 });
});
