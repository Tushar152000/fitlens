import { NextResponse } from "next/server";
import { auth, signIn } from "@/auth";
import { isAllowedRedirect, isChallenge, signCode } from "@/lib/mobile-auth";

/**
 * Step 1 of the app sign-in hand-off (see src/lib/mobile-auth.ts). Opened in the phone's browser:
 * signs the user in on the web if needed, then sends a one-time code back to the app.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const challenge = url.searchParams.get("challenge") ?? "";
  const redirect = url.searchParams.get("redirect") ?? "";
  if (!isChallenge(challenge) || !isAllowedRedirect(redirect)) {
    return NextResponse.json({ error: "Invalid sign-in request" }, { status: 400 });
  }

  const session = await auth();
  if (!session?.user?.id) {
    // Straight to Google's account picker; it comes back here signed in. Throws a redirect.
    await signIn("google", { redirectTo: url.pathname + url.search });
  }
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Sign-in failed" }, { status: 401 });

  const back = new URL(redirect);
  back.searchParams.set("code", signCode(userId, challenge));
  return NextResponse.redirect(back);
}
