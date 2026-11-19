import type { BillingDto, MeDto, PremiumFeature, ProRequiredDetails } from "@fitr8/contracts";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { useEffect } from "react";
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

/** Opens the Premium screen, led by the feature the user just tried. */
export function openPremium(feature?: PremiumFeature, source?: "onboarding") {
  router.push({ pathname: "/pro", params: { ...(feature ? { feature } : {}), ...(source ? { source } : {}) } });
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
export function handlePremiumError(err: unknown): boolean {
  const feature = premiumFeatureOf(err);
  if (!feature) return false;
  openPremium(feature);
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
      if (!cancelled) openPremium(undefined, "onboarding");
    })();
    return () => {
      cancelled = true;
    };
  }, [plan, onboardedAt, me.id]);
}
