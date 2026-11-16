import type { LabelRead, MealAnalysis, ReminderDraft } from "@fitr8/contracts";
import type { AiResult, FoodExtractor, ReminderRequest } from "./types.js";

const SAMPLE: MealAnalysis = {
  isFood: true,
  hiddenFatLikely: true,
  notes: "Mock result: set AI_PROVIDER=anthropic for real detection.",
  items: [
    {
      name: "roti",
      quantity: 2,
      unit: "piece",
      grams: 80,
      confidence: 0.93,
      isDrink: false,
      per100g: { kcal: 264, protein: 8.9, carbs: 46, fat: 5 },
    },
    {
      name: "dal tadka",
      quantity: 1,
      unit: "katori",
      grams: 150,
      confidence: 0.84,
      isDrink: false,
      per100g: { kcal: 120, protein: 6, carbs: 15, fat: 4 },
    },
    {
      name: "jeera rice",
      quantity: 1,
      unit: "katori",
      grams: 150,
      confidence: 0.71,
      isDrink: false,
      per100g: { kcal: 150, protein: 2.8, carbs: 28, fat: 3 },
    },
    {
      name: "mixed veg sabzi",
      quantity: 0.5,
      unit: "katori",
      grams: 75,
      confidence: 0.55,
      isDrink: false,
      per100g: { kcal: 90, protein: 2.5, carbs: 10, fat: 4.5 },
    },
  ],
};

/** Deterministic fake provider for local development and tests. */
export class MockExtractor implements FoodExtractor {
  readonly name = "mock";

  async analyzeMealPhoto(): Promise<AiResult<MealAnalysis>> {
    return this.result(SAMPLE);
  }

  async parseMealText({ text }: { text: string }): Promise<AiResult<MealAnalysis>> {
    // Very small parser: "2 roti, 1 katori dal" → items. Good enough for UI work.
    const items = text
      .split(/,|\band\b|\n/i)
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const m = part.match(
          /^(\d+(?:\.\d+)?)\s*(piece|pieces|katori|cup|bowl|plate|glass|g)?\s*(.+)$/i,
        );
        const quantity = m ? Number(m[1]) : 1;
        const unit = (m?.[2] ?? "piece").toLowerCase().replace(/s$/, "");
        const name = (m?.[3] ?? part).toLowerCase();
        const grams =
          unit === "g" ? quantity : quantity * (unit === "katori" || unit === "bowl" ? 150 : 50);
        // Rough generic home-food estimate; the food database replaces it when the name matches.
        const per100g = { kcal: 150, protein: 5, carbs: 20, fat: 5 };
        const isDrink = ["glass", "cup", "ml"].includes(unit);
        return { name, quantity, unit, grams, confidence: 0.6, isDrink, per100g };
      });
    return this.result({ isFood: items.length > 0, hiddenFatLikely: false, items });
  }

  async readNutritionLabel(): Promise<AiResult<LabelRead>> {
    return {
      data: {
        isLabel: true,
        productName: "Mock biscuits",
        per100g: { kcal: 480, protein: 7, carbs: 70, fat: 19, sugar: 25, sodiumMg: 300 },
        servingSizeG: 25,
        servingLabel: "3 biscuits (25 g)",
        confidence: 0.9,
      },
      usage: { provider: this.name, model: "mock", latencyMs: 5 },
    };
  }

  async parseReminder({ text }: ReminderRequest): Promise<AiResult<ReminderDraft>> {
    return {
      data: mockReminderDraft(text),
      usage: { provider: this.name, model: "mock", latencyMs: 5 },
    };
  }

  private async result(data: MealAnalysis): Promise<AiResult<MealAnalysis>> {
    return { data, usage: { provider: this.name, model: "mock", latencyMs: 5 } };
  }
}

const DAY_WORDS: Record<string, number> = {
  sun: 0,
  sunday: 0,
  mon: 1,
  monday: 1,
  tue: 2,
  tuesday: 2,
  wed: 3,
  wednesday: 3,
  thu: 4,
  thursday: 4,
  fri: 5,
  friday: 5,
  sat: 6,
  saturday: 6,
};
const PART_OF_DAY: Record<string, number> = {
  morning: 8,
  noon: 12,
  afternoon: 14,
  evening: 19,
  night: 21,
};
const NTH: Record<string, number> = { first: 1, second: 2, third: 3, fourth: 4, fifth: 5 };
const DAY_ALT = "sun|mon|tue|wed|thu|fri|sat";

interface Clause {
  minute: number | null;
  hours: string | null;
  dom: string | null;
  dow: string | null;
}

/** One "… and …" part: its own time(s) and day(s), each null when it doesn't say. */
function readClause(t: string): Clause {
  const times: { h: number; m: number }[] = [];
  for (const m of t.matchAll(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/g)) {
    times.push({ h: (Number(m[1]) % 12) + (m[3] === "pm" ? 12 : 0), m: Number(m[2] ?? 0) });
  }
  if (!times.length) {
    for (const [word, h] of Object.entries(PART_OF_DAY)) {
      if (new RegExp(`\\b${word}\\b`).test(t)) times.push({ h, m: 0 });
    }
  }
  const every = /every\s+(\d+)\s+hours?/.exec(t);
  let hours: string | null = null;
  if (every) {
    const from = times[0]?.h ?? 9;
    hours = `${from}-${Math.max(from, times[1]?.h ?? 21)}/${Number(every[1])}`;
  } else if (times.length) {
    hours = [...new Set(times.map((x) => x.h))].sort((a, b) => a - b).join(",");
  }

  let dom: string | null = null;
  let dow: string | null = null;
  const nthDay = new RegExp(
    `\\b(first|second|third|fourth|fifth|last)\\s+(${DAY_ALT})[a-z]*\\b`,
  ).exec(t);
  const fromEnd =
    /\b(?:(second|third)[\s-]+)?last\b(?:\s+(?:day|evening|morning|night))?\s+of\s+(?:the|every)\s+month\b/.exec(
      t,
    );
  const ordinals = [...t.matchAll(/\b(\d{1,2})(?:st|nd|rd|th)\b/g)].map((m) => Number(m[1]));
  const nthWord =
    /\b(first|second|third|fourth|fifth)(?:\s+day)?\s+of\s+(?:the|every)\s+month\b/.exec(t);
  if (nthDay) {
    const weekday = DAY_WORDS[nthDay[2]!]!;
    dow = nthDay[1] === "last" ? `${weekday}L` : `${weekday}#${NTH[nthDay[1]!]}`;
  } else if (fromEnd || /\bend of (?:the )?month\b/.test(t)) {
    const n = fromEnd?.[1] === "second" ? 1 : fromEnd?.[1] === "third" ? 2 : 0;
    dom = n ? `L-${n}` : "L";
  } else if (ordinals.length) {
    dom = [...new Set(ordinals.map((d) => Math.min(Math.max(d, 1), 31)))].join(",");
  } else if (nthWord) {
    dom = String(NTH[nthWord[1]!]);
  } else if (/\bmonth(ly|s)?\b/.test(t)) {
    dom = "1";
  } else if (/\bweekdays?\b/.test(t)) dow = "1-5";
  else if (/\bweekends?\b/.test(t)) dow = "0,6";
  else {
    const named = [...t.matchAll(new RegExp(`\\b(${DAY_ALT})[a-z]*\\b`, "g"))]
      .map((m) => DAY_WORDS[m[0]] ?? DAY_WORDS[m[1]!])
      .filter((d): d is number => d !== undefined);
    if (named.length) dow = [...new Set(named)].sort((a, b) => a - b).join(",");
  }
  return { minute: times[0]?.m ?? null, hours, dom, dow };
}

/**
 * A rule-based stand-in for the model so dev and tests work offline. Understands clock times
 * ("9 am", "6pm", "7:30 pm"), parts of the day, "every N hours", weekdays/weekends and day names,
 * monthly dates ("the 15th", "first of the month"), the last / second-last day, "first Monday",
 * and several "… and …" parts each with its own day and time.
 */
export function mockReminderDraft(text: string): ReminderDraft {
  const t = text.toLowerCase();
  const clauses = t
    .split(
      /\s+and\s+(?=(?:on\s+|in\s+|at\s+)?(?:the\s+|every\s+)?(?:\d|first|second|third|fourth|fifth|last|end|mon|tue|wed|thu|fri|sat|sun|week|morning|evening|night|afternoon))/,
    )
    .map(readClause)
    .filter((c) => c.hours || c.dom || c.dow);

  const crons: string[] = [];
  let prev: Clause = { minute: 0, hours: "9", dom: null, dow: null };
  for (const c of clauses) {
    const hours = c.hours ?? prev.hours ?? "9";
    const minute = c.hours ? (c.minute ?? 0) : (prev.minute ?? 0);
    // A clause with only a time keeps the previous days; days set the rule's shape.
    const dom = c.dom ?? (c.dow ? null : prev.dom);
    const dow = c.dow ?? (c.dom ? null : prev.dow);
    crons.push(`${minute} ${hours} ${dom ?? "*"} * ${dow ?? "*"}`);
    prev = { minute, hours, dom, dow };
  }

  const isReminder =
    crons.length > 0 || /\b(remind|every|daily|weekly|monthly|each|once)\b/.test(t);
  const what =
    text
      .replace(/^\s*(please\s+)?(remind me|reminder)\s+(to\s+)?/i, "")
      .split(
        /\s+(?:every|at|on|in\s+the|each|once|daily|weekly|monthly|from|tonight|tomorrow|\d{1,2}(?::\d{2})?\s*(?:am|pm))\b/i,
      )[0]
      ?.trim() ?? "";
  return {
    isReminder,
    title: what ? what[0]!.toUpperCase() + what.slice(1, 40) : "Reminder",
    description: "",
    // No time or day said at all → every day at 9:00 am.
    crons: crons.length ? crons : ["0 9 * * *"],
  };
}
