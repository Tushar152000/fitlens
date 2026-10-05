/**
 * Only same-site paths, so the sign-in flow can't be used as an open redirect. Rejects "//host"
 * and "/\host": URL parsers and browsers treat a backslash like a slash, so both mean another host.
 */
export const safePath = (p: unknown): string =>
  typeof p === "string" && /^\/(?![/\\])/.test(p) ? p : "/today";
