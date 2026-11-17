/**
 * "Welcome back": a user who has been away long enough that their body numbers (weight, height,
 * activity, training time) are probably out of date is asked only those again, not the whole
 * onboarding. Everything else (sex, birth date, diet, goal) is kept.
 */

const DAY_MS = 86_400_000;

/** Away this long (about three months) and we ask for the numbers that change again. */
export const WELCOME_BACK_AFTER_DAYS = 90;

/** Record activity at most this often, so the app's launch call doesn't write on every request. */
export const ACTIVITY_TOUCH_MS = 60 * 60 * 1000;

export interface ActivityState {
  /** Null until onboarding is done: a new user does full onboarding, never "welcome back". */
  onboardedAt: Date | null;
  /** Last time the user used the app. Null for accounts that predate tracking. */
  lastActiveAt: Date | null;
}

/** The last thing we know the user did: activity, else the onboarding itself. */
const lastSeen = (s: ActivityState): Date | null => s.lastActiveAt ?? s.onboardedAt;

/** True when an onboarded user is back after WELCOME_BACK_AFTER_DAYS or more without using the app. */
export function isWelcomeBack(s: ActivityState, now: Date): boolean {
  const last = lastSeen(s);
  if (!s.onboardedAt || !last) return false;
  return now.getTime() - last.getTime() >= WELCOME_BACK_AFTER_DAYS * DAY_MS;
}

/**
 * Whether this visit should be recorded as activity. Never while a "welcome back" is pending: the
 * prompt must survive an app restart until the user answers or dismisses it.
 */
export function shouldTouchActivity(s: ActivityState, now: Date): boolean {
  if (!s.onboardedAt || isWelcomeBack(s, now)) return false;
  return !s.lastActiveAt || now.getTime() - s.lastActiveAt.getTime() >= ACTIVITY_TOUCH_MS;
}
