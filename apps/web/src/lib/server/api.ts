import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { apiBaseUrl } from "@/lib/api-base";
import { ApiError } from "@/lib/api-error";
import type { MeDto, ProfileDto } from "@fitr8/contracts";

export { ApiError };

/**
 * Calls @fitr8/api from a server component or server action as the signed-in user, by forwarding
 * the incoming request's cookie. Never cached. Redirects to /login on 401; otherwise throws ApiError
 * with the API's `{ error, details }` (status 0 when the API can't be reached).
 */
export async function serverApi<T>(
  path: string,
  init?: RequestInit & { json?: unknown },
): Promise<T> {
  const incoming = await headers();
  const { json, ...rest } = init ?? {};
  const forwarded = new Headers(rest.headers);
  const cookie = incoming.get("cookie");
  if (cookie) forwarded.set("cookie", cookie);
  const ip = incoming.get("x-forwarded-for");
  if (ip) forwarded.set("x-forwarded-for", ip);
  const requestId = incoming.get("x-request-id");
  if (requestId) forwarded.set("x-request-id", requestId);
  if (json !== undefined) forwarded.set("content-type", "application/json");

  let res: Response;
  try {
    res = await fetch(`${apiBaseUrl()}/api${path}`, {
      ...rest,
      headers: forwarded,
      body: json !== undefined ? JSON.stringify(json) : rest.body,
      cache: "no-store",
    });
  } catch {
    throw new ApiError(0, "Couldn't reach FITR8. Try again in a moment.");
  }

  // Outside any try/catch: redirect() works by throwing.
  if (res.status === 401) redirect("/login");
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as {
      error?: string;
      details?: unknown;
    } | null;
    throw new ApiError(res.status, body?.error ?? `Request failed (${res.status})`, body?.details);
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}

/** Like serverApi, but resolves to null on an API error (not on 401, which still redirects). */
export async function serverApiOrNull<T>(path: string): Promise<T | null> {
  try {
    return await serverApi<T>(path);
  } catch (err) {
    if (err instanceof ApiError) return null;
    throw err; // includes Next's redirect signal
  }
}

/** GET /api/me without the 401 redirect, for pages that are fine signed out (/, /login). */
export async function currentUser(): Promise<MeDto | null> {
  const incoming = await headers();
  const cookie = incoming.get("cookie");
  if (!cookie) return null;
  try {
    const res = await fetch(`${apiBaseUrl()}/api/me`, { headers: { cookie }, cache: "no-store" });
    return res.ok ? ((await res.json()) as MeDto) : null;
  } catch {
    return null;
  }
}

export interface Viewer {
  userId: string;
  name: string | null;
  email: string | null;
  image: string | null;
  profile: ProfileDto | null;
  timezone: string;
}

/** Signed-in user + profile for server components, deduped per request. Redirects to /login when signed out. */
export const requireViewer = cache(async (): Promise<Viewer> => {
  const me = await serverApi<MeDto>("/me");
  return {
    userId: me.id,
    name: me.name ?? null,
    email: me.email ?? null,
    image: me.image ?? null,
    profile: me.profile,
    timezone: me.profile?.timezone ?? "Asia/Kolkata",
  };
});

/** Like requireViewer, but also sends users who haven't finished onboarding to /onboarding. */
export async function requireOnboardedViewer(): Promise<Viewer & { profile: ProfileDto }> {
  const viewer = await requireViewer();
  if (!viewer.profile?.onboardedAt) redirect("/onboarding");
  return { ...viewer, profile: viewer.profile };
}
