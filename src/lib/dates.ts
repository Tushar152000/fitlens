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
