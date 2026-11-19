/**
 * (UI-only: the app depends on @fitr8/contracts alone, docs/ARCHITECTURE.md.)
 * When the Premium banner on Today may show (docs/PREMIUM.md, design 14). Dates are local
 * "YYYY-MM-DD" strings. ✕ hides it for the rest of the day; hidden 3 days in a row, it rests for
 * 7 days. Never in the first 3 days after sign-up.
 */
export interface BannerDismissals {
  /** Last day it was hidden. */
  last: string | null;
  /** Days in a row it has been hidden, ending `last`. */
  streak: number;
  /** Hidden until (not including) this day. */
  pausedUntil: string | null;
}

export const NO_DISMISSALS: BannerDismissals = { last: null, streak: 0, pausedUntil: null };
export const BANNER_NEW_USER_DAYS = 3;
export const BANNER_PAUSE_AFTER = 3;
export const BANNER_PAUSE_DAYS = 7;

/** "2026-11-19" + n days, calendar arithmetic (no time zones involved). */
export function addDaysYmd(ymd: string, n: number): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Hidden today: dismissed today, or still in a pause. */
export function bannerHidden(d: BannerDismissals, today: string): boolean {
  return d.last === today || (d.pausedUntil !== null && today < d.pausedUntil);
}

/** Dismissing today: one more day in a row (or a fresh run); the 3rd in a row starts a 7-day pause. */
export function dismissBanner(d: BannerDismissals, today: string): BannerDismissals {
  const streak = d.last === addDaysYmd(today, -1) ? d.streak + 1 : 1;
  return streak >= BANNER_PAUSE_AFTER
    ? { last: today, streak: 0, pausedUntil: addDaysYmd(today, BANNER_PAUSE_DAYS + 1) }
    : { last: today, streak, pausedUntil: null };
}

/** The account is too new for upsells (first 3 days after onboarding). */
export function bannerTooEarly(onboardedAt: string | null | undefined, now: Date): boolean {
  if (!onboardedAt) return true;
  return now.getTime() - new Date(onboardedAt).getTime() < BANNER_NEW_USER_DAYS * 86_400_000;
}
