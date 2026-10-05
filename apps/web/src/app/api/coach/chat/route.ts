import { apiBaseUrl } from "@/lib/api-base";

/**
 * Transport only: pipes POST /api/coach/chat to @fitr8/api and streams the reply back unchanged.
 *
 * Every other /api path goes through src/proxy.ts. This one is a route handler because Next gzips
 * proxied responses, and gzip holds small server-sent events back until its buffer fills. Here the
 * response carries `Cache-Control: no-transform`, which turns compression off, so each event reaches
 * the browser as soon as the API writes it. Aborting the browser request aborts the upstream one.
 */
export async function POST(request: Request) {
  const headers = new Headers({
    "content-type": request.headers.get("content-type") ?? "application/json",
    accept: "text/event-stream",
  });
  for (const name of ["cookie", "authorization", "x-forwarded-for", "x-request-id", "user-agent"]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${apiBaseUrl()}/api/coach/chat`, {
      method: "POST",
      headers,
      body: await request.text(),
      signal: request.signal,
      cache: "no-store",
    });
  } catch {
    return Response.json(
      { error: "Couldn't reach your coach. Check your connection and try again." },
      { status: 502 },
    );
  }

  const out = new Headers({ "cache-control": "no-cache, no-transform", "x-accel-buffering": "no" });
  for (const name of ["content-type", "x-request-id", "retry-after"]) {
    const value = upstream.headers.get(name);
    if (value) out.set(name, value);
  }
  for (const cookie of upstream.headers.getSetCookie()) out.append("set-cookie", cookie);
  return new Response(upstream.body, { status: upstream.status, headers: out });
}
