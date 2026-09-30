/** Browser-side JSON fetch for our same-origin /api routes (Next rewrites them to @fitlens/api). Throws ApiError with the server's message. */
import { ApiError } from "@/lib/api-error";

export { ApiError };

export async function api<T>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init ?? {};
  let res: Response;
  try {
    res = await fetch(url, {
      ...rest,
      headers:
        json !== undefined ? { "Content-Type": "application/json", ...rest.headers } : rest.headers,
      body: json !== undefined ? JSON.stringify(json) : rest.body,
    });
  } catch {
    throw new ApiError(0, "Couldn't reach FitLens. Check your connection and try again.");
  }
  if (res.status === 401 && typeof window !== "undefined") {
    window.location.assign(new URL("/login", window.location.origin).href);
  }
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(res.status, body?.error ?? `Request failed (${res.status})`, body?.details);
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}
