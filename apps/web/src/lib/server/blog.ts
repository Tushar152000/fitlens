import type { BlogPostSummaryDto } from "@fitr8/contracts";
import { apiBaseUrl } from "@/lib/api-base";

/**
 * Public blog reads for server rendering: no cookie, never cached by Next. Next's fetch cache keeps
 * serving the last good response when a refresh comes back 404, so an unpublished, deleted or
 * renamed post would stay up; rendering per request keeps /blog exactly in step with the admin.
 * Search engines still get full server-rendered HTML. Caching: see .claude/context/decisions.md.
 */

export type BlogResult<T> =
  { ok: true; data: T } | { ok: false; status: number; details?: { redirectTo?: string } };

export async function blogGet<T>(path: string): Promise<BlogResult<T>> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/blog${path}`, {
      cache: "no-store",
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as {
        details?: { redirectTo?: string };
      } | null;
      return { ok: false, status: res.status, details: body?.details };
    }
    return { ok: true, data: (await res.json()) as T };
  } catch {
    // API unreachable (e.g. during a build without it): render an empty state, never crash.
    return { ok: false, status: 0 };
  }
}

/** The data, or `fallback` on any failure. */
export async function blogGetOr<T>(path: string, fallback: T): Promise<T> {
  const r = await blogGet<T>(path);
  return r.ok ? r.data : fallback;
}

/**
 * The newest posts for the landing page's "From the blog". Cached for 5 minutes so `/` stays
 * static; a stale card is harmless here (the post page itself is always fresh). Empty on failure.
 */
export async function latestPosts(count = 3): Promise<BlogPostSummaryDto[]> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/blog/posts?page=1`, { next: { revalidate: 300 } });
    if (!res.ok) return [];
    const page = (await res.json()) as { posts: BlogPostSummaryDto[] };
    return page.posts.slice(0, count);
  } catch {
    return [];
  }
}
