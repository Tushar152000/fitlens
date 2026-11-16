/**
 * Reminder schedules. A reminder has one or more rules, each a standard 5-field cron string
 * ("minute hour day-of-month month day-of-week") with the common extensions people actually say:
 *
 *   L / L-1      last / second-last day of the month           "0 18 L-1 * *"
 *   1#1 / 5L     first Monday / last Friday of the month         "0 7 * * 1#1"
 *   1,15  1-5    lists and ranges                                "0 9 1,15 * *"
 *   9-21/3       hour steps                                      "0 9-21/3 * * *"
 *   JAN-MAR      specific months (yearly reminders)              "0 9 1 JAN *"
 *
 * Times are the phone's local wall-clock time; the server never fires anything, it only stores the
 * rules. Phones repeat a local notification daily, weekly or monthly on a fixed date, so a rule of
 * that shape becomes repeating alerts (`scheduleSlots`). Anything else (moving days like "the
 * second-last day", picked months, the 29th–31st) is scheduled as its next few exact times
 * (`upcomingTimes`), which the app tops up every time it opens.
 */

/** One reminder's repeating alerts must fit the phone's limit (iOS: 64 pending for the whole app). */
export const MAX_REMINDER_SLOTS = 24;
/** Exact upcoming times scheduled per moving rule; the app re-plans them on every launch. */
export const UPCOMING_PER_RULE = 3;
/** Rules per reminder ("9 am on the 1st and 6 pm on the second-last day" is two). */
export const MAX_RULES = 6;
/** Reminders per account. */
export const MAX_REMINDERS = 20;

/** Which days a rule fires on. */
export type DayRule =
  /** Days of the week, 0 = Sunday … 6 = Saturday. All seven = every day. */
  | { kind: "weekdays"; weekdays: number[] }
  /** Days of the month: dates 1–31 and/or counted from the end (0 = last day, 1 = second-last …). */
  | { kind: "monthDays"; days: number[]; fromEnd: number[] }
  /** The nth weekday of the month: n 1–5, or -1 for the last one ("last Friday"). */
  | { kind: "nthWeekday"; items: { weekday: number; n: number }[] };

export interface ReminderRule {
  minute: number;
  /** 0–23, ascending. */
  hours: number[];
  /** 1–12, ascending. All twelve = every month. */
  months: number[];
  days: DayRule;
}

/**
 * One repeating alert for a fixed-shape rule: monthly on `day` (1–28) when set, else weekly on
 * `weekday` (0 = Sunday), else daily.
 */
export interface ReminderSlot {
  day: number | null;
  weekday: number | null;
  hour: number;
  minute: number;
}

/** A wall-clock moment without a timezone: the phone's own local time. */
export interface LocalDateTime {
  year: number;
  /** 1–12 */
  month: number;
  day: number;
  hour: number;
  minute: number;
}

export type RuleResult = { ok: true; rule: ReminderRule } | { ok: false; error: string };

const DAY_NAMES = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const MONTH_NAMES = [
  "JAN",
  "FEB",
  "MAR",
  "APR",
  "MAY",
  "JUN",
  "JUL",
  "AUG",
  "SEP",
  "OCT",
  "NOV",
  "DEC",
];
const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTH_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
/** A monthly repeating alert needs a date every month has. */
const MAX_FIXED_MONTH_DAY = 28;

/** Expand one cron field ("*", "5", "1-5", "9-21/2", "1,3,5", names) to sorted values, or null if invalid. */
function expandField(
  field: string,
  min: number,
  max: number,
  names: string[] = [],
  nameBase = min,
): number[] | null {
  const values = new Set<number>();
  const value = (s: string): number | null => {
    const named = names.indexOf(s.toUpperCase());
    if (named >= 0) return named + nameBase;
    if (!/^\d+$/.test(s)) return null;
    return Number(s);
  };
  for (const part of field.split(",")) {
    const m = /^(\*|[A-Za-z0-9]+(?:-[A-Za-z0-9]+)?)(?:\/(\d+))?$/.exec(part);
    if (!m) return null;
    const [, range, stepRaw] = m;
    const step = stepRaw === undefined ? 1 : Number(stepRaw);
    if (step < 1) return null;
    let from: number | null;
    let to: number | null;
    if (range === "*") {
      from = min;
      to = max;
    } else if (range!.includes("-")) {
      const [a, b] = range!.split("-");
      from = value(a!);
      to = value(b!);
    } else {
      from = value(range!);
      // "5/2" means "from 5, every 2" in most cron dialects.
      to = stepRaw === undefined ? from : max;
    }
    if (from === null || to === null || from < min || to > max || from > to) return null;
    for (let v = from; v <= to; v += step) values.add(v);
  }
  return [...values].sort((a, b) => a - b);
}

const sorted = (s: Set<number>) => [...s].sort((a, b) => a - b);

/** Day-of-month field: dates, ranges, steps, plus L (last day) and L-n (n days before the last). */
function parseMonthDays(field: string): { days: number[]; fromEnd: number[] } | null {
  const days = new Set<number>();
  const fromEnd = new Set<number>();
  for (const part of field.split(",")) {
    const end = /^L(?:-(\d{1,2}))?$/i.exec(part);
    if (end) {
      const n = Number(end[1] ?? 0);
      if (n > 27) return null;
      fromEnd.add(n);
      continue;
    }
    const plain = expandField(part, 1, 31);
    if (!plain) return null;
    plain.forEach((d) => days.add(d));
  }
  return { days: sorted(days), fromEnd: sorted(fromEnd) };
}

/** Day-of-week items like 1#2 (second Monday) or 5L / FRIL (last Friday). */
function parseNthWeekdays(field: string): { weekday: number; n: number }[] | null {
  const items: { weekday: number; n: number }[] = [];
  for (const part of field.split(",")) {
    const m = /^([A-Za-z]{3}|[0-7])(?:#([1-5])|(L))$/i.exec(part);
    if (!m) return null;
    const named = DAY_NAMES.indexOf(m[1]!.toUpperCase());
    if (named < 0 && !/^\d$/.test(m[1]!)) return null;
    const weekday = named >= 0 ? named : Number(m[1]) % 7;
    items.push({ weekday, n: m[3] ? -1 : Number(m[2]) });
  }
  return items;
}

/** Parse one cron rule, or a short, user-facing reason it can't be a reminder. */
export function parseRule(cron: string): RuleResult {
  const fields = cron.trim().split(/\s+/);
  if (fields.length !== 5) {
    return { ok: false, error: "A schedule needs 5 parts: minute hour day month weekday" };
  }
  const [minuteF, hourF, domF, monthF, dowF] = fields as [string, string, string, string, string];

  const minutes = expandField(minuteF, 0, 59);
  if (!minutes || minutes.length !== 1) {
    return { ok: false, error: "Pick one minute past the hour (e.g. 9:30), not several" };
  }
  const hours = expandField(hourF, 0, 23);
  if (!hours) return { ok: false, error: "That hour isn't valid (use 0–23)" };
  const months = expandField(monthF, 1, 12, MONTH_NAMES, 1);
  if (!months) return { ok: false, error: "Those months aren't valid" };

  let days: DayRule;
  if (domF !== "*" && dowF !== "*") {
    return { ok: false, error: "Pick days of the month or days of the week, not both" };
  }
  if (domF !== "*") {
    const md = parseMonthDays(domF);
    if (!md) return { ok: false, error: "Those days of the month aren't valid" };
    days = { kind: "monthDays", ...md };
  } else if (dowF.split(",").some((p) => /#|L$/i.test(p))) {
    const items = parseNthWeekdays(dowF);
    if (!items) return { ok: false, error: "Those days aren't valid" };
    days = { kind: "nthWeekday", items };
  } else {
    // 7 is Sunday too in most cron dialects.
    const dows = expandField(dowF, 0, 7, DAY_NAMES);
    if (!dows) return { ok: false, error: "Those days aren't valid" };
    days = { kind: "weekdays", weekdays: sorted(new Set(dows.map((d) => d % 7))) };
  }

  const rule: ReminderRule = { minute: minutes[0]!, hours, months, days };
  if (isRepeating(rule)) {
    const count = scheduleSlots(rule).length;
    if (count > MAX_REMINDER_SLOTS) {
      const per = days.kind === "monthDays" ? "a month" : everyDay(rule) ? "a day" : "a week";
      return {
        ok: false,
        error: `That's ${count} alerts ${per} for one reminder. Keep it to ${MAX_REMINDER_SLOTS} — fewer times or fewer days.`,
      };
    }
  } else if (hours.length > 4) {
    return { ok: false, error: "On changing dates, pick up to 4 times a day" };
  }
  return { ok: true, rule };
}

/** Parse every rule of a reminder; the first problem wins. */
export function parseRules(
  crons: string[],
): { ok: true; rules: ReminderRule[] } | { ok: false; error: string } {
  if (!crons.length) return { ok: false, error: "Add a time for the reminder" };
  if (crons.length > MAX_RULES)
    return { ok: false, error: `Keep it to ${MAX_RULES} times or fewer` };
  const rules: ReminderRule[] = [];
  for (const cron of crons) {
    const r = parseRule(cron);
    if (!r.ok) return r;
    rules.push(r.rule);
  }
  const slots = rules.reduce((n, r) => n + scheduleSlots(r).length, 0);
  if (slots > MAX_REMINDER_SLOTS) {
    return {
      ok: false,
      error: `That's ${slots} repeating alerts for one reminder. Keep it to ${MAX_REMINDER_SLOTS}.`,
    };
  }
  return { ok: true, rules };
}

const allMonths = (r: ReminderRule) => r.months.length === 12;
const everyDay = (r: ReminderRule) => r.days.kind === "weekdays" && r.days.weekdays.length === 7;

/**
 * Can a phone repeat it by itself? Daily, weekly, or monthly on fixed dates every month has.
 * Everything else is scheduled as upcoming exact times.
 */
export function isRepeating(r: ReminderRule): boolean {
  if (!allMonths(r)) return false;
  if (r.days.kind === "weekdays") return true;
  if (r.days.kind === "monthDays") {
    return r.days.fromEnd.length === 0 && r.days.days.every((d) => d <= MAX_FIXED_MONTH_DAY);
  }
  return false;
}

/** The repeating alerts of a fixed-shape rule (empty for a changing one). */
export function scheduleSlots(r: ReminderRule): ReminderSlot[] {
  if (!isRepeating(r)) return [];
  const at = (hour: number) => ({ hour, minute: r.minute });
  const d = r.days;
  if (d.kind === "monthDays") {
    return d.days.flatMap((day) => r.hours.map((h) => ({ day, weekday: null, ...at(h) })));
  }
  if (d.kind === "weekdays" && d.weekdays.length < 7) {
    return d.weekdays.flatMap((weekday) => r.hours.map((h) => ({ day: null, weekday, ...at(h) })));
  }
  return r.hours.map((h) => ({ day: null, weekday: null, ...at(h) }));
}

// ── Calendar maths on wall-clock dates (UTC fields used as a plain calendar, no timezone) ──

const daysInMonth = (year: number, month: number) =>
  new Date(Date.UTC(year, month, 0)).getUTCDate();

/** Does the rule fire on this calendar date (month 1–12)? */
function firesOn(r: ReminderRule, year: number, month: number, day: number): boolean {
  if (!r.months.includes(month)) return false;
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  const d = r.days;
  if (d.kind === "weekdays") return d.weekdays.includes(weekday);
  if (d.kind === "monthDays") {
    const last = daysInMonth(year, month);
    return d.days.includes(day) || d.fromEnd.includes(last - day);
  }
  return d.items.some(
    (it) =>
      it.weekday === weekday &&
      (it.n === -1 ? day + 7 > daysInMonth(year, month) : Math.ceil(day / 7) === it.n),
  );
}

/**
 * The next `count` times the rule fires strictly after `now` (both wall-clock), searching up to
 * two years ahead. Used for changing rules, and for "next" in summaries.
 */
export function upcomingTimes(
  r: ReminderRule,
  now: LocalDateTime,
  count = UPCOMING_PER_RULE,
): LocalDateTime[] {
  const out: LocalDateTime[] = [];
  const start = Date.UTC(now.year, now.month - 1, now.day);
  for (let i = 0; i <= 731 && out.length < count; i++) {
    const date = new Date(start + i * 86_400_000);
    const [year, month, day] = [date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate()];
    if (!firesOn(r, year, month, day)) continue;
    for (const hour of r.hours) {
      const later = i > 0 || hour > now.hour || (hour === now.hour && r.minute > now.minute);
      if (later && out.length < count) out.push({ year, month, day, hour, minute: r.minute });
    }
  }
  return out;
}

/** "2026-11-28T18:00" — how a wall-clock time travels to the phone. */
export function formatLocal(t: LocalDateTime): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${t.year}-${p(t.month)}-${p(t.day)}T${p(t.hour)}:${p(t.minute)}`;
}

/** Back to cron, canonical form: "30 9 * * *", "0 9,13 * * 1-5", "0 9 1,L-1 * *", "0 7 * * 1#1". */
export function toCron(r: ReminderRule): string {
  const d = r.days;
  const month = allMonths(r) ? "*" : compact(r.months);
  if (d.kind === "monthDays") {
    const dom = [compact(d.days), ...d.fromEnd.map((n) => (n === 0 ? "L" : `L-${n}`))]
      .filter(Boolean)
      .join(",");
    return `${r.minute} ${compact(r.hours)} ${dom} ${month} *`;
  }
  if (d.kind === "nthWeekday") {
    const dow = d.items
      .map((it) => (it.n === -1 ? `${it.weekday}L` : `${it.weekday}#${it.n}`))
      .join(",");
    return `${r.minute} ${compact(r.hours)} * ${month} ${dow}`;
  }
  const dow = d.weekdays.length === 7 ? "*" : compact(d.weekdays);
  return `${r.minute} ${compact(r.hours)} * ${month} ${dow}`;
}

/** [1,2,3,5] → "1-3,5" (runs of 3+ become ranges). */
function compact(values: number[]): string {
  const parts: string[] = [];
  for (let i = 0; i < values.length;) {
    let j = i;
    while (j + 1 < values.length && values[j + 1] === values[j]! + 1) j++;
    parts.push(j - i >= 2 ? `${values[i]}-${values[j]}` : values.slice(i, j + 1).join(","));
    i = j + 1;
  }
  return parts.join(",");
}

// ── Plain English ──

/** "9:00 am", "12:30 pm". */
export function formatClock(hour: number, minute: number): string {
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}:${String(minute).padStart(2, "0")} ${hour < 12 ? "am" : "pm"}`;
}

/** 1 → "1st", 2 → "2nd", 13 → "13th", 22 → "22nd". */
export function ordinal(n: number): string {
  const tens = n % 100;
  const suffix = tens >= 11 && tens <= 13 ? "th" : (["th", "st", "nd", "rd"][n % 10] ?? "th");
  return `${n}${suffix}`;
}

const NTH_WORD = ["", "first", "second", "third", "fourth", "fifth"];

function list(items: string[]): string {
  return items.length <= 1
    ? (items[0] ?? "")
    : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}

function fromEndWord(n: number): string {
  if (n === 0) return "last day";
  if (n === 1) return "second-last day";
  return `${ordinal(n + 1)}-last day`;
}

function describeDays(r: ReminderRule): string {
  const d = r.days;
  const months = list(r.months.map((m) => MONTH_SHORT[m - 1]!));
  if (d.kind === "weekdays") {
    let days: string;
    if (d.weekdays.length === 7) days = "Every day";
    else if (d.weekdays.join() === "1,2,3,4,5") days = "Weekdays";
    else if (d.weekdays.join() === "0,6") days = "Weekends";
    else {
      // Monday-first reads naturally in India.
      const ordered = [...d.weekdays].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
      days =
        ordered.length === 1
          ? `Every ${DAY_SHORT[ordered[0]!]}`
          : ordered.map((x) => DAY_SHORT[x]).join(", ");
    }
    return allMonths(r) ? days : `${days} in ${months}`;
  }
  if (d.kind === "monthDays") {
    const parts = [...d.days.map(ordinal), ...d.fromEnd.map(fromEndWord)];
    return allMonths(r)
      ? `Every month on the ${list(parts)}`
      : `On the ${list(parts)} of ${months}`;
  }
  const parts = d.items.map(
    (it) => `${it.n === -1 ? "last" : NTH_WORD[it.n]} ${DAY_LONG[it.weekday]}`,
  );
  return `On the ${list(parts)} of ${allMonths(r) ? "every month" : months}`;
}

/** One rule in plain English: "Every day at 9:00 am", "Every month on the second-last day at 6:00 pm". */
export function describeRule(r: ReminderRule): string {
  const days = describeDays(r);
  const { hours, minute } = r;
  if (hours.length === 1) return `${days} at ${formatClock(hours[0]!, minute)}`;
  const step = hours[1]! - hours[0]!;
  const regular = hours.length >= 3 && hours.every((h, i) => i === 0 || h - hours[i - 1]! === step);
  if (regular) {
    const every = step === 1 ? "every hour" : `every ${step} hours`;
    return `${days}, ${every} from ${formatClock(hours[0]!, minute)} to ${formatClock(hours.at(-1)!, minute)}`;
  }
  return `${days} at ${list(hours.map((h) => formatClock(h, minute)))}`;
}

/** A whole reminder: its rules joined ("Every month on the 1st at 9:00 am; and every month …"). */
export function describeRules(rules: ReminderRule[]): string {
  const parts = rules.map(describeRule);
  if (parts.length <= 1) return parts[0] ?? "";
  const last = parts.at(-1)!;
  return `${parts.slice(0, -1).join("; ")}; and ${last.charAt(0).toLowerCase()}${last.slice(1)}`;
}
