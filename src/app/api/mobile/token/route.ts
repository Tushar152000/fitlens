import { NextResponse } from "next/server";
import { z } from "zod";
import { parseBody, route } from "@/lib/api";
import { createMobileSession, redeemCode } from "@/lib/mobile-auth";

const Body = z.object({ code: z.string().min(1).max(1000), verifier: z.string().min(43).max(128) });

/** Step 2 of the app sign-in hand-off: trades the code + PKCE verifier for a bearer token. */
export const POST = route(async (req) => {
  const { code, verifier } = await parseBody(req, Body);
  const userId = redeemCode(code, verifier);
  return NextResponse.json(await createMobileSession(userId), { status: 201 });
});
