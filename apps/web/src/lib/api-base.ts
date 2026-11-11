/**
 * Where this Next server reaches @fitr8/api for server-side rendering. API_INTERNAL_URL lets a
 * deployment use a private address (e.g. http://api:4000 in Docker); otherwise the public one.
 * Read at call time, not build time. The browser uses `apiUrl()` from ./api-url instead.
 */
export function apiBaseUrl(): string {
  return (
    process.env.API_INTERNAL_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    "http://localhost:4000"
  ).replace(/\/+$/, "");
}
