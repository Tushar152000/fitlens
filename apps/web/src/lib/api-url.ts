/**
 * The public address of @fitr8/api as browsers reach it: https://api.fitr8.com in production,
 * http://localhost:4000 locally. The web has no backend of its own — the browser calls the API
 * directly with its session cookie (shared across *.fitr8.com by the API's AUTH_COOKIE_DOMAIN).
 * NEXT_PUBLIC_ values are inlined at build time, so each deployment builds with its own.
 */
export const PUBLIC_API_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000").replace(
  /\/+$/,
  "",
);

/** Absolute API URL for a path such as "/api/me". */
export function apiUrl(path: string): string {
  return `${PUBLIC_API_URL}${path}`;
}
