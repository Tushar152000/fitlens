import { NextResponse } from "next/server";
import { HttpError, requireUserId, route } from "@/lib/api";
import { getProduct, lookupBarcode } from "@/lib/services/barcode";

type Ctx = RouteContext<"/api/foods/barcode/[code]">;

/** Look up a packaged food by barcode. Never uses a photo scan. 404 = unknown product. */
export const GET = route<Ctx>(async (_req, ctx) => {
  const userId = await requireUserId();
  const { code } = await ctx.params;
  const result = await lookupBarcode(code, userId);
  if (result.status === "invalid") throw new HttpError(400, "That isn't a valid barcode");
  if (result.status === "not_found")
    throw new HttpError(404, "We don't know this product yet", { code: result.code });
  return NextResponse.json({ code: result.code, food: await getProduct(result.foodId) });
});
