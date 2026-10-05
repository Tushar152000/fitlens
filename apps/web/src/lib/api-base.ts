/**
 * Where this Next server reaches @fitr8/api (e.g. http://api:4000 in Docker). Read at call time, not
 * module load or build time, so one image works in every environment. Server-side only; the browser
 * uses same-origin /api.
 */
export function apiBaseUrl(): string {
  return (process.env.API_INTERNAL_URL || "http://localhost:4000").replace(/\/+$/, "");
}
