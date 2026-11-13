import type { AnalyticsEventName, AnalyticsEvents } from "@fitr8/contracts";
import { isRunningInExpoGo } from "expo";
import { Platform } from "react-native";

/**
 * Google Analytics for the app, through Firebase Analytics (docs/ANALYTICS.md). Sends nothing until
 * the Firebase config files are in the build (app.config.ts), and never on the web preview or in
 * Expo Go. Every call is fire-and-forget: analytics must never break or slow the app.
 */
type Firebase = {
  analytics: import("@react-native-firebase/analytics").Analytics;
  mod: typeof import("@react-native-firebase/analytics");
};

let firebase: Firebase | null | undefined;

function load(): Firebase | null {
  if (firebase !== undefined) return firebase;
  firebase = null;
  if (Platform.OS === "web" || isRunningInExpoGo()) return firebase;
  try {
    // Lazy so the web preview and Expo Go never load the native module.
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- must not load on web / Expo Go
    const app: typeof import("@react-native-firebase/app") = require("@react-native-firebase/app");
    // No google-services.json / GoogleService-Info.plist in this build → no default app → off.
    if (app.getApps().length === 0) return firebase;
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- same as above
    const mod: typeof import("@react-native-firebase/analytics") = require("@react-native-firebase/analytics");
    firebase = { analytics: mod.getAnalytics(), mod };
  } catch {
    firebase = null;
  }
  return firebase;
}

/** True when this build reports to Google Analytics. */
export function analyticsEnabled(): boolean {
  return load() !== null;
}

export function track<E extends AnalyticsEventName>(name: E, params: AnalyticsEvents[E]): void {
  const fb = load();
  if (!fb) return;
  try {
    // Our event map is narrower than Firebase's overloads; the generic overload takes any name.
    (fb.mod.logEvent as (a: unknown, n: string, p?: object) => void)(fb.analytics, name, params);
  } catch {
    // Never let analytics surface to the user.
  }
}

/** Route pattern, never the real path: `log/[id]`, not a meal id. */
export function trackScreen(screen: string): void {
  const fb = load();
  if (!fb) return;
  fb.mod.logScreenView(fb.analytics, { screen_name: screen, screen_class: screen }).catch(() => undefined);
}

/** FITR8's internal user id (never an email); null on sign-out. */
export function setAnalyticsUser(id: string | null): void {
  const fb = load();
  if (!fb) return;
  fb.mod.setUserId(fb.analytics, id).catch(() => undefined);
}
