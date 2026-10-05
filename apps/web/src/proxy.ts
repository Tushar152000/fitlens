import { NextResponse, type NextRequest } from "next/server";
import { apiBaseUrl } from "@/lib/api-base";

/**
 * Same-origin /api/* → @fitr8/api. The browser only ever talks to this origin, so the session cookie
 * stays first-party. The API origin is read per request (API_INTERNAL_URL is only known when the
 * container starts); next.config rewrites would bake it in at build time.
 *
 * Next proxies external rewrites with a streaming HTTP proxy: bodies are piped (not buffered),
 * Set-Cookie and redirects pass through unchanged, and a client disconnect closes the upstream request.
 * The coach chat stream is the one exception, served by app/api/coach/chat/route.ts (see there).
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (pathname === "/api/coach/chat") return NextResponse.next();
  return NextResponse.rewrite(new URL(`${pathname}${search}`, `${apiBaseUrl()}/`));
}

export const config = {
  matcher: "/api/:path*",
};
