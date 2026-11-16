import { describe, expect, it } from "vitest";
import {
  describeRule,
  describeRules,
  formatClock,
  formatLocal,
  isRepeating,
  MAX_REMINDER_SLOTS,
  ordinal,
  parseRule,
  parseRules,
  scheduleSlots,
  toCron,
  upcomingTimes,
  type LocalDateTime,
  type ReminderRule,
} from "./reminders.js";

const parse = (cron: string): ReminderRule => {
  const r = parseRule(cron);
  if (!r.ok) throw new Error(r.error);
  return r.rule;
};
const error = (cron: string) => {
  const r = parseRule(cron);
  return r.ok ? null : r.error;
};
const ALL_MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const at = (year: number, month: number, day: number, hour: number, minute = 0): LocalDateTime => ({
  year,
  month,
  day,
  hour,
  minute,
});
const next = (cron: string, now: LocalDateTime, n = 3) =>
  upcomingTimes(parse(cron), now, n).map(formatLocal);

describe("parseRule", () => {
  it("reads a daily time", () => {
    expect(parse("30 9 * * *")).toEqual({
      minute: 30,
      hours: [9],
      months: ALL_MONTHS,
      days: { kind: "weekdays", weekdays: [0, 1, 2, 3, 4, 5, 6] },
    });
  });

  it("reads hour lists, ranges and steps", () => {
    expect(parse("0 8,13,20 * * *").hours).toEqual([8, 13, 20]);
    expect(parse("0 9-12 * * *").hours).toEqual([9, 10, 11, 12]);
    expect(parse("0 9-21/2 * * *").hours).toEqual([9, 11, 13, 15, 17, 19, 21]);
    expect(parse("0 */6 * * *").hours).toEqual([0, 6, 12, 18]);
    expect(parse("0 18/2 * * *").hours).toEqual([18, 20, 22]);
  });

  it("reads weekdays as numbers, names, ranges and 7 = Sunday", () => {
    const wd = (cron: string) => (parse(cron).days as { weekdays: number[] }).weekdays;
    expect(wd("0 7 * * 1-5")).toEqual([1, 2, 3, 4, 5]);
    expect(wd("0 7 * * MON,wed,FRI")).toEqual([1, 3, 5]);
    expect(wd("0 7 * * 6,7")).toEqual([0, 6]);
    expect(wd("0 7 * * 0,7")).toEqual([0]);
  });

  it("reads days of the month, the last day and days before it", () => {
    expect(parse("0 9 1,15 * *").days).toEqual({ kind: "monthDays", days: [1, 15], fromEnd: [] });
    expect(parse("0 18 L-1 * *").days).toEqual({ kind: "monthDays", days: [], fromEnd: [1] });
    expect(parse("0 9 1,L * *").days).toEqual({ kind: "monthDays", days: [1], fromEnd: [0] });
  });

  it("reads the nth and last weekday of the month", () => {
    expect(parse("0 7 * * 1#1").days).toEqual({
      kind: "nthWeekday",
      items: [{ weekday: 1, n: 1 }],
    });
    expect(parse("0 7 * * FRIL,5#2").days).toEqual({
      kind: "nthWeekday",
      items: [
        { weekday: 5, n: -1 },
        { weekday: 5, n: 2 },
      ],
    });
  });

  it("reads specific months", () => {
    expect(parse("0 9 1 JAN *").months).toEqual([1]);
    expect(parse("0 9 1 1,4,7,10 *").months).toEqual([1, 4, 7, 10]);
  });

  it("rejects what can't be a reminder, in plain words", () => {
    expect(error("0 9 * *")).toMatch(/5 parts/);
    expect(error("0,30 9 * * *")).toMatch(/one minute/);
    expect(error("* 9 * * *")).toMatch(/one minute/);
    expect(error("0 24 * * *")).toMatch(/hour/);
    expect(error("0 9-5 * * *")).toMatch(/hour/);
    expect(error("0 9 1 * 1")).toMatch(/not both/);
    expect(error("0 9 32 * *")).toMatch(/days of the month/);
    expect(error("0 9 L-28 * *")).toMatch(/days of the month/);
    expect(error("0 9 * 13 *")).toMatch(/months/);
    expect(error("0 9 * * 8")).toMatch(/days/);
    expect(error("0 9 * * 1#6")).toMatch(/days/);
    expect(error("0 9 * * FUNDAY")).toMatch(/days/);
  });

  it(`caps repeating alerts at ${MAX_REMINDER_SLOTS}, and times on changing dates at 4`, () => {
    expect(error("0 * * * *")).toBeNull(); // 24 a day
    expect(error("0 9-21/2 * * 1-5")).toMatch(/35 alerts a week/);
    expect(error("0 * 1,2 * *")).toMatch(/48 alerts a month/);
    expect(error("0 8-12 L * *")).toMatch(/up to 4 times/);
  });
});

describe("parseRules", () => {
  it("takes several rules, each with its own day and time", () => {
    const r = parseRules(["0 9 1 * *", "0 18 L-1 * *"]);
    expect(r.ok && r.rules.length).toBe(2);
  });

  it("checks the rule count, each rule, and the repeating total", () => {
    expect(parseRules([])).toEqual({ ok: false, error: "Add a time for the reminder" });
    expect(parseRules(Array(7).fill("0 9 * * *"))).toMatchObject({ ok: false, error: /6 times/ });
    expect(parseRules(["0 9 * * *", "nope"])).toMatchObject({ ok: false, error: /5 parts/ });
    expect(parseRules(["0 0-11 * * *", "30 12-23 * * *", "15 5 * * *"])).toMatchObject({
      ok: false,
      error: /25 repeating alerts/,
    });
  });
});

describe("isRepeating and scheduleSlots", () => {
  it("repeats daily, weekly and fixed monthly dates on the phone", () => {
    expect(scheduleSlots(parse("0 9,21 * * *"))).toEqual([
      { day: null, weekday: null, hour: 9, minute: 0 },
      { day: null, weekday: null, hour: 21, minute: 0 },
    ]);
    expect(scheduleSlots(parse("15 7 * * 1,3"))).toEqual([
      { day: null, weekday: 1, hour: 7, minute: 15 },
      { day: null, weekday: 3, hour: 7, minute: 15 },
    ]);
    expect(scheduleSlots(parse("0 9 1,15 * *"))).toEqual([
      { day: 1, weekday: null, hour: 9, minute: 0 },
      { day: 15, weekday: null, hour: 9, minute: 0 },
    ]);
  });

  it("leaves changing dates to exact upcoming times", () => {
    for (const cron of ["0 18 L-1 * *", "0 9 31 * *", "0 7 * * 1#1", "0 9 1 JAN *", "0 9 * 6 1"]) {
      expect(isRepeating(parse(cron))).toBe(false);
      expect(scheduleSlots(parse(cron))).toEqual([]);
    }
  });
});

describe("upcomingTimes", () => {
  const now = at(2026, 11, 17, 10); // Tuesday 17 Nov 2026, 10:00

  it("finds the second-last day of each month (27th in Feb, 29th or 30th otherwise)", () => {
    expect(next("0 18 L-1 * *", now)).toEqual([
      "2026-11-29T18:00",
      "2026-12-30T18:00",
      "2027-01-30T18:00",
    ]);
    expect(next("0 18 L-1 * *", at(2027, 2, 1, 0), 1)).toEqual(["2027-02-27T18:00"]);
    expect(next("0 18 L-1 * *", at(2028, 2, 1, 0), 1)).toEqual(["2028-02-28T18:00"]); // leap year
  });

  it("finds the first Monday and the last Friday", () => {
    expect(next("0 7 * * 1#1", now, 2)).toEqual(["2026-12-07T07:00", "2027-01-04T07:00"]);
    expect(next("0 7 * * 5L", now, 2)).toEqual(["2026-11-27T07:00", "2026-12-25T07:00"]);
  });

  it("only uses months that have the date, and picked months", () => {
    expect(next("0 9 31 * *", now, 3)).toEqual([
      "2026-12-31T09:00",
      "2027-01-31T09:00",
      "2027-03-31T09:00",
    ]);
    expect(next("0 9 1 JAN *", now, 2)).toEqual(["2027-01-01T09:00", "2028-01-01T09:00"]);
  });

  it("starts strictly after now, later today included", () => {
    expect(next("0 9,21 * * *", now, 2)).toEqual(["2026-11-17T21:00", "2026-11-18T09:00"]);
    expect(next("0 10 * * *", now, 1)).toEqual(["2026-11-18T10:00"]);
    expect(next("30 10 * * *", now, 1)).toEqual(["2026-11-17T10:30"]);
  });
});

describe("toCron", () => {
  it("writes a canonical, re-parseable form", () => {
    expect(toCron(parse("30 9 * * 0-6"))).toBe("30 9 * * *");
    expect(toCron(parse("0 9-21/2 * * SAT,SUN"))).toBe("0 9,11,13,15,17,19,21 * * 0,6");
    expect(toCron(parse("0 8,9,10,14 * * 1,2,5"))).toBe("0 8-10,14 * * 1,2,5");
    expect(toCron(parse("0 9 L-1,1 * *"))).toBe("0 9 1,L-1 * *");
    expect(toCron(parse("0 7 * JAN-MAR FRIL"))).toBe("0 7 * 1-3 5L");
    for (const cron of ["0 9 1,L * *", "0 7 * * 1#1,5L", "45 6 * * 0,6", "0 9 15 6 *"]) {
      expect(parse(toCron(parse(cron)))).toEqual(parse(cron));
    }
  });
});

describe("describeRule / describeRules", () => {
  it("says it in plain English", () => {
    expect(describeRule(parse("0 9 * * *"))).toBe("Every day at 9:00 am");
    expect(describeRule(parse("30 19 * * 1-5"))).toBe("Weekdays at 7:30 pm");
    expect(describeRule(parse("0 8 * * 0,6"))).toBe("Weekends at 8:00 am");
    expect(describeRule(parse("0 6 * * 0"))).toBe("Every Sun at 6:00 am");
    expect(describeRule(parse("0 6 * * 0,1,3"))).toBe("Mon, Wed, Sun at 6:00 am");
    expect(describeRule(parse("0 9-21/2 * * *"))).toBe(
      "Every day, every 2 hours from 9:00 am to 9:00 pm",
    );
    expect(describeRule(parse("0 8,13 * * *"))).toBe("Every day at 8:00 am and 1:00 pm");
    expect(describeRule(parse("0 9 1 * *"))).toBe("Every month on the 1st at 9:00 am");
    expect(describeRule(parse("0 18 L-1 * *"))).toBe(
      "Every month on the second-last day at 6:00 pm",
    );
    expect(describeRule(parse("0 9 2,22,L * *"))).toBe(
      "Every month on the 2nd, 22nd and last day at 9:00 am",
    );
    expect(describeRule(parse("0 7 * * 1#1"))).toBe(
      "On the first Monday of every month at 7:00 am",
    );
    expect(describeRule(parse("0 7 * * 5L"))).toBe("On the last Friday of every month at 7:00 am");
    expect(describeRule(parse("0 9 1 JAN *"))).toBe("On the 1st of Jan at 9:00 am");
  });

  it("joins several rules", () => {
    const r = parseRules(["0 9 1 * *", "0 18 L-1 * *"]);
    expect(r.ok && describeRules(r.rules)).toBe(
      "Every month on the 1st at 9:00 am; and every month on the second-last day at 6:00 pm",
    );
  });

  it("formats clock times and ordinals", () => {
    expect(formatClock(0, 5)).toBe("12:05 am");
    expect(formatClock(12, 0)).toBe("12:00 pm");
    expect(formatClock(23, 59)).toBe("11:59 pm");
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 28].map(ordinal)).toEqual([
      "1st",
      "2nd",
      "3rd",
      "4th",
      "11th",
      "12th",
      "13th",
      "21st",
      "22nd",
      "23rd",
      "28th",
    ]);
  });
});
