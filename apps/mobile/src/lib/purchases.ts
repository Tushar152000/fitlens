import { Platform } from "react-native";
import Purchases, { PACKAGE_TYPE, type PurchasesPackage } from "react-native-purchases";

/**
 * FITR8 Pro purchases through RevenueCat (docs/PREMIUM.md). The App Store / Play key comes from
 * EXPO_PUBLIC_REVENUECAT_IOS_KEY / _ANDROID_KEY (public SDK keys, not secrets). Without one the app
 * still runs; the paywall says purchases aren't available yet.
 */
const KEY = Platform.select({
  ios: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY,
  android: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY,
});

export const purchasesAvailable = Boolean(KEY);
let configured = false;

/** After sign-in: purchases belong to this FITR8 user id, so the webhook knows who bought Pro. */
export async function identifyPurchaser(userId: string) {
  if (!KEY) return;
  if (!configured) {
    Purchases.configure({ apiKey: KEY, appUserID: userId });
    configured = true;
  } else {
    await Purchases.logIn(userId);
  }
}

/** On sign-out, so the next person on this phone doesn't inherit the purchase. */
export async function forgetPurchaser() {
  if (!configured) return;
  await Purchases.logOut().catch(() => undefined); // throws when already anonymous
}

export interface ProPlan {
  pkg: PurchasesPackage;
  period: "year" | "month";
  price: string;
  /** e.g. 7 when the store offers a 7-day free trial to this user. */
  trialDays: number | null;
}

/** The current offering's yearly and monthly packages, with store prices and trial. */
export async function proPlans(): Promise<ProPlan[]> {
  if (!configured) return [];
  const offering = (await Purchases.getOfferings()).current;
  if (!offering) return [];
  const plans: ProPlan[] = [];
  for (const pkg of offering.availablePackages) {
    const period =
      pkg.packageType === PACKAGE_TYPE.ANNUAL ? "year" : pkg.packageType === PACKAGE_TYPE.MONTHLY ? "month" : null;
    if (!period) continue;
    plans.push({ pkg, period, price: pkg.product.priceString, trialDays: trialDays(pkg) });
  }
  return plans.sort((a) => (a.period === "year" ? -1 : 1));
}

function trialDays(pkg: PurchasesPackage): number | null {
  const toDays = (unit?: string, n?: number) =>
    n ? (unit === "WEEK" ? n * 7 : unit === "MONTH" ? n * 30 : unit === "DAY" ? n : null) : null;
  const intro = pkg.product.introPrice; // iOS
  if (intro && intro.price === 0) return toDays(intro.periodUnit, intro.periodNumberOfUnits);
  const free = pkg.product.defaultOption?.freePhase; // Android
  return free ? toDays(free.billingPeriod?.unit, free.billingPeriod?.value) : null;
}

/** Buys a plan. Resolves false if the person backed out of the store sheet. */
export async function buyPlan(plan: ProPlan): Promise<boolean> {
  try {
    await Purchases.purchasePackage(plan.pkg);
    return true;
  } catch (err) {
    if ((err as { userCancelled?: boolean }).userCancelled) return false;
    throw new Error("The purchase didn't go through. You haven't been charged. Try again.");
  }
}

export async function restorePurchases() {
  if (!configured) return;
  await Purchases.restorePurchases();
}

/** Where people manage or cancel a store subscription. */
export const manageSubscriptionUrl =
  Platform.OS === "ios"
    ? "https://apps.apple.com/account/subscriptions"
    : "https://play.google.com/store/account/subscriptions";
