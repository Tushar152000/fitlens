import type { AnalyticsEvents, BillingDto, MeDto, PremiumFeature, ProRequiredDetails } from "@fitr8/contracts";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { useEffect, useSyncExternalStore } from "react";
import { Platform } from "react-native";
import { ApiError } from "./api";
import { billingQuery } from "./queries";

export type { PremiumFeature };

/**
 * FITR8 Premium gating in the app (docs/PREMIUM.md). The server decides (GET /api/billing limits);
 * the app only uses them to open the Premium screen *before* a call that would fail, so a free user
 * taps a Premium feature and sees what it unlocks instead of an error.
 */

/** Is this feature outside the user's plan? `count` = how many they already have (reminders). */
export function isLocked(billing: BillingDto | undefined, feature: PremiumFeature, count = 0): boolean {
  if (!billing || billing.plan === "PRO") return false;
  const l = billing.limits;
  switch (feature) {
    case "photo_scan":
      return l.scans === 0;
    case "label_scan":
      return !l.labelScans;
    case "barcode":
      return !l.barcode;
    case "coach":
      return l.coach === 0;
    case "reminders":
      return count >= l.reminders;
  }
}

/** The plan and a `locked(feature)` check for the signed-in user. */
export function usePremium() {
  const billing = useQuery(billingQuery);
  return {
    billing: billing.data,
    isPremium: billing.data?.plan === "PRO",
    locked: (feature: PremiumFeature, count?: number) => isLocked(billing.data, feature, count),
  };
}

/**
 * Launch prices (docs/PREMIUM.md), shown wherever the store's prices aren't loaded (banner, sheet,
 * Profile). The Premium screen uses the store's localised prices when it has them.
 */
export const LIST_PRICE = {
  month: "₹149",
  year: "₹1,499",
  perMonth: "₹125",
  perDayUnder: "₹5",
  yearSaving: "₹289",
};

/** Where the Premium screen was opened from (analytics `source`). */
export type PaywallSource = AnalyticsEvents["paywall_viewed"]["source"];
export type FeatureLabel = AnalyticsEvents["premium_locked_sheet_shown"]["feature"];

/** Premium feature → its short analytics label. */
export const FEATURE_LABEL: Record<PremiumFeature, FeatureLabel> = {
  photo_scan: "photo",
  barcode: "barcode",
  label_scan: "label",
  coach: "coach",
  reminders: "reminders",
};

/** Opens the Premium screen (14c). Never call it for a Premium user: they get Manage subscription. */
export function openPaywall(source: PaywallSource) {
  router.push({ pathname: "/pro", params: { source } });
}

/** The meal slot and day being logged, kept for the locked sheet's free path ("Type this meal instead"). */
export type LogContext = { meal?: string; date?: string };

type Locked = { feature: PremiumFeature; context: LogContext } | null;
let locked: Locked = null;
const lockedListeners = new Set<() => void>();
function setLocked(next: Locked) {
  locked = next;
  for (const l of lockedListeners) l();
}

/** The locked-feature sheet's state (rendered once, in the root layout). */
export function useLockedSheet() {
  const state = useSyncExternalStore(
    (l) => {
      lockedListeners.add(l);
      return () => lockedListeners.delete(l);
    },
    () => locked,
    () => locked,
  );
  return { state, close: () => setLocked(null) };
}

/**
 * A free user tapped a Premium feature. Food logging and the coach open the locked sheet (14b): an
 * example of what the feature does, the plans, and the free alternative. Reminders go straight to
 * the Premium screen (the reminders screen already explains the free 3).
 */
export function openPremium(feature: PremiumFeature, context: LogContext = {}) {
  if (feature === "reminders") return openPaywall("locked_reminders");
  setLocked({ feature, context });
}

/** The feature of a 402 "pro_required" from the API, or null for any other error. */
export function premiumFeatureOf(err: unknown): PremiumFeature | null {
  if (!(err instanceof ApiError) || err.status !== 402) return null;
  const details = err.details as Partial<ProRequiredDetails> | undefined;
  return details?.reason === "pro_required" && details.feature ? details.feature : null;
}

/**
 * For catch blocks: a 402 from the API opens the Premium screen and returns true (show no error);
 * anything else returns false.
 */
export function handlePremiumError(err: unknown, context?: LogContext): boolean {
  const feature = premiumFeatureOf(err);
  if (!feature) return false;
  openPremium(feature, context);
  return true;
}

// ── First login ───────────────────────────────────────────────────────────

/** How long after onboarding the first-login Premium screen may still show (app opened later). */
const INTRO_WINDOW_MS = 24 * 60 * 60 * 1000;

const introKey = (userId: string) => `fitr8.premium.intro.${userId}`;

async function introShown(userId: string): Promise<boolean> {
  try {
    if (Platform.OS === "web") return globalThis.localStorage?.getItem(introKey(userId)) === "1";
    return (await SecureStore.getItemAsync(introKey(userId))) === "1";
  } catch {
    return false;
  }
}

async function markIntroShown(userId: string) {
  try {
    if (Platform.OS === "web") globalThis.localStorage?.setItem(introKey(userId), "1");
    else await SecureStore.setItemAsync(introKey(userId), "1");
  } catch {
    // Worst case the intro shows once more on this phone.
  }
}

/**
 * On Today: the first-login Premium screen ("Your plan is ready"), once per user, for a free user
 * who finished onboarding in the last 24 hours (in the app or on the web). Based on the server's
 * onboarding time, so it can't miss the moment the app switches from onboarding to Today.
 */
export function usePremiumIntro(me: Pick<MeDto, "id" | "profile">) {
  const billing = useQuery(billingQuery);
  const plan = billing.data?.plan;
  const onboardedAt = me.profile?.onboardedAt;
  useEffect(() => {
    if (plan !== "FREE" || !onboardedAt) return;
    if (Date.now() - new Date(onboardedAt).getTime() > INTRO_WINDOW_MS) return;
    let cancelled = false;
    void (async () => {
      if (cancelled || (await introShown(me.id))) return;
      await markIntroShown(me.id);
      if (!cancelled) openPaywall("onboarding");
    })();
    return () => {
      cancelled = true;
    };
  }, [plan, onboardedAt, me.id]);
}
