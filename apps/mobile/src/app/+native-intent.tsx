/**
 * Incoming deep links, before Expo Router matches them to a screen.
 *
 * Google sign-in finishes at `fitlens://auth?code=…` (or `?error=…`). `WebBrowser.openAuthSessionAsync`
 * reads that URL itself (see `lib/auth.tsx`), but on Android the same link also opens the app and
 * reaches the router, which has no `auth` screen and would show "Unmatched Route". Send it to the
 * root instead; `index.tsx` then routes by auth state.
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  try {
    const { hostname, pathname } = new URL(path, "fitlens://");
    const route = `${hostname}${pathname}`.replace(/^\/+|\/+$/g, "");
    if (route === "auth") return "/";
  } catch {
    // Not a URL we understand: let the router handle it as before.
  }
  return path;
}
