import { NextResponse } from "next/server";
import { HttpError, parseBody, requireUserId, route } from "@/lib/api";
import { assertWithinTextCap, parseExtraItems } from "@/lib/services/meals";
import { ParseItemsSchema } from "@/lib/validators";

/** AI calls run inline when there's no Redis worker (e.g. on Vercel). */
export const maxDuration = 60;

/** Describe something to add to a meal ("2 sachets sugar") and get priced items back. Nothing is saved. */
export const POST = route(async (req) => {
  const userId = await requireUserId();
  const { text, mealType } = await parseBody(req, ParseItemsSchema);
  await assertWithinTextCap(userId);
  const items = await parseExtraItems(userId, text, mealType).catch(() => {
    throw new HttpError(502, "Couldn't work that out. Try wording it differently.");
  });
  return NextResponse.json({ items });
});
