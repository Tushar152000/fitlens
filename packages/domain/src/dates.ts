/** Calendar date (YYYY-MM-DD) for "today" in a user's timezone, as a UTC-midnight Date for @db.Date columns. */
export function localDate(timezone = "Asia/Kolkata", at = new Date()): Date {
  const ymd = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);
  return new Date(`${ymd}T00:00:00.000Z`);
}

export function parseDateOnly(ymd: string): Date {
  return new Date(`${ymd}T00:00:00.000Z`);
}

/** Monday of the week containing `date` (UTC date-only). */
export function weekStart(date: Date): Date {
  const d = new Date(date);
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day);
  return d;
}

/** The UTC instant of local midnight at the start of `at`'s day in `timezone` (DST-safe to the minute). */
export function startOfLocalDay(timezone = "Asia/Kolkata", at = new Date()): Date {
  const ymd = localDate(timezone, at);
  const guess = ymd.getTime(); // local midnight read as if it were UTC
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(new Date(guess))
      .map((p) => [p.type, p.value]),
  );
  const shown = Date.UTC(
    +parts.year,
    +parts.month - 1,
    +parts.day,
    +parts.hour,
    +parts.minute,
    +parts.second,
  );
  return new Date(guess - (shown - guess));
}

/** How many days back a forgotten meal can still be logged (today plus this many earlier days). */
export const MEAL_BACKFILL_DAYS = 7;

const DAY_MS = 86_400_000;

/**
 * Why a meal can't be logged on `date` (both UTC-midnight date-only values), or null when it can:
 * today or up to MEAL_BACKFILL_DAYS earlier, never a future day.
 */
export function mealDateProblem(date: Date, today: Date): string | null {
  if (Number.isNaN(date.getTime())) return "Use a real date (YYYY-MM-DD)";
  const daysBack = Math.round((today.getTime() - date.getTime()) / DAY_MS);
  if (daysBack < 0) return "You can't log a meal for a future day";
  if (daysBack > MEAL_BACKFILL_DAYS) {
    return `You can log meals for today or up to ${MEAL_BACKFILL_DAYS} days back`;
  }
  return null;
}
