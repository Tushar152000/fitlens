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

export interface LimitConfig {
  /** Free photo scans a day (AI_DAILY_LIMIT). */
  freeScans: number;
  /** Pro photo scans a day: fair use (AI_PRO_DAILY_LIMIT). */
  proScans: number;
  /** Free coach messages a day once the paywall is on (COACH_FREE_DAILY_LIMIT). */
  freeCoach: number;
  /** Pro coach messages a day; also everyone's limit while the paywall is off (COACH_DAILY_LIMIT). */
  proCoach: number;
}

export interface DailyLimits {
  scans: number;
  coach: number;
  /** Photographing nutrition labels. */
  labelScans: boolean;
}

/**
 * Daily limits for a plan. With the paywall off (before Pro can be bought) free users keep
 * today's limits: the free scan limit, the full coach limit and label scans.
 */
export function dailyLimits(plan: Plan, paywall: boolean, cfg: LimitConfig): DailyLimits {
  if (plan === "PRO") return { scans: cfg.proScans, coach: cfg.proCoach, labelScans: true };
  return paywall
    ? { scans: cfg.freeScans, coach: cfg.freeCoach, labelScans: false }
    : { scans: cfg.freeScans, coach: cfg.proCoach, labelScans: true };
}

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
