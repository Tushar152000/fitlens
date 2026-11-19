/**
 * FITR8 Pro (docs/PREMIUM.md): who has Pro, how a RevenueCat event changes that, and the daily
 * limits per plan. Pure: the API's billing module persists the result.
 */

export type Plan = "FREE" | "PRO";

/** What we store per user. `lifetime` = a non-expiring purchase. */
export interface ProAccess {
  proUntil: Date | null;
  lifetime: boolean;
}

export function isPro(access: ProAccess | null | undefined, now = new Date()): boolean {
  if (!access) return false;
  return access.lifetime || (access.proUntil !== null && access.proUntil > now);
}

export const planOf = (access: ProAccess | null | undefined, now = new Date()): Plan =>
  isPro(access, now) ? "PRO" : "FREE";

// ── Limits ─────────────────────────────────────────────────────────────────

/** Premium features a free user can hit; the app opens the Premium screen for each (docs/PREMIUM.md). */
export const PREMIUM_FEATURES = [
  "photo_scan",
  "label_scan",
  "barcode",
  "coach",
  "reminders",
] as const;
export type PremiumFeature = (typeof PREMIUM_FEATURES)[number];

/** Custom reminders: the free plan, and Premium's fair-use cap. */
export const FREE_REMINDERS = 3;
export const PREMIUM_REMINDERS = 50;

export interface LimitConfig {
  /** Premium photo scans a day: fair use (AI_PRO_DAILY_LIMIT). */
  proScans: number;
  /** Premium coach messages a day (COACH_DAILY_LIMIT). */
  proCoach: number;
}

export interface DailyLimits {
  /** Photo scans a day (meals and nutrition labels). 0 = a Premium feature for this user. */
  scans: number;
  /** Coach messages a day. 0 = a Premium feature for this user. */
  coach: number;
  /** Photographing nutrition labels. */
  labelScans: boolean;
  /** Looking up packaged food by barcode. */
  barcode: boolean;
  /** Custom reminders the user can keep. */
  reminders: number;
}

/**
 * Limits for a plan (docs/PREMIUM.md "Rules"): free users get no AI photo scans, coach or barcode,
 * and 3 custom reminders; Premium gets all of them with fair-use limits.
 */
export function dailyLimits(plan: Plan, cfg: LimitConfig): DailyLimits {
  return plan === "PRO"
    ? {
        scans: cfg.proScans,
        coach: cfg.proCoach,
        labelScans: true,
        barcode: true,
        reminders: PREMIUM_REMINDERS,
      }
    : { scans: 0, coach: 0, labelScans: false, barcode: false, reminders: FREE_REMINDERS };
}

/** Days of Premium a test purchase gives (until store billing is connected). */
export const TEST_PURCHASE_DAYS = { month: 30, year: 365 } as const;

// ── RevenueCat events ──────────────────────────────────────────────────────

/** The fields of a RevenueCat webhook event this logic reads. */
export interface RevenueCatEvent {
  type: string;
  entitlement_ids?: string[] | null;
  expiration_at_ms?: number | null;
  grace_period_expiration_at_ms?: number | null;
}

export type AccessChange = ProAccess & { willRenew: boolean };

/** Events that (re)grant access until `expiration_at_ms`. */
const GRANTS = new Set([
  "INITIAL_PURCHASE",
  "RENEWAL",
  "UNCANCELLATION",
  "PRODUCT_CHANGE",
  "SUBSCRIPTION_EXTENDED",
  "TEMPORARY_ENTITLEMENT_GRANT",
  "REFUND_REVERSED",
  "NON_RENEWING_PURCHASE",
]);

/**
 * How one event changes Pro access, or null when it doesn't (TEST, TRANSFER, pauses, other
 * entitlements). Cancellation keeps access until the period ends (a refund's expiration is the
 * refund time); a billing issue keeps it through the store's grace period.
 */
export function accessFromEvent(
  event: RevenueCatEvent,
  entitlementId: string,
): AccessChange | null {
  if (event.entitlement_ids && !event.entitlement_ids.includes(entitlementId)) return null;
  const at = (ms: number | null | undefined) => (typeof ms === "number" ? new Date(ms) : null);
  const expires = at(event.expiration_at_ms);

  if (GRANTS.has(event.type)) {
    const lifetime = event.type === "NON_RENEWING_PURCHASE" && expires === null;
    return { proUntil: expires, lifetime, willRenew: event.type !== "NON_RENEWING_PURCHASE" };
  }
  switch (event.type) {
    case "CANCELLATION":
      return { proUntil: expires, lifetime: false, willRenew: false };
    case "EXPIRATION":
      return { proUntil: expires ?? new Date(0), lifetime: false, willRenew: false };
    case "BILLING_ISSUE":
      return {
        proUntil: at(event.grace_period_expiration_at_ms) ?? expires,
        lifetime: false,
        willRenew: true,
      };
    default:
      return null;
  }
}
