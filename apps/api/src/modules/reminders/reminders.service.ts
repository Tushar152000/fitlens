import { Inject, Injectable } from "@nestjs/common";
import type { ReminderInput, ReminderUpdateInput } from "@fitr8/contracts";
import { startOfLocalDay } from "@fitr8/domain/dates";
import {
  describeRule,
  describeRules,
  formatLocal,
  isRepeating,
  MAX_REMINDERS,
  parseRules,
  scheduleSlots,
  toCron,
  upcomingTimes,
  UPCOMING_PER_RULE,
  type LocalDateTime,
  type ReminderRule,
} from "@fitr8/domain/reminders";
import { AppError, notFound } from "../../common/errors.js";
import { PrismaService } from "../../infra/prisma/prisma.service.js";
import { FOOD_EXTRACTOR, type FoodExtractor } from "../ai/index.js";
import { UsersService } from "../users/users.service.js";

/** Turning words into a reminder is cheap but not free; this only stops runaway use. */
const PARSE_DAILY_CAP = 30;

type ReminderRow = {
  id: string;
  title: string;
  description: string | null;
  crons: string[];
  enabled: boolean;
  prompt: string | null;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Reminders: the server stores the rules only. The phone schedules local notifications from the
 * derived `slots` (repeating) and `upcoming` (exact times for changing dates), so nothing here
 * ever sends anything.
 */
@Injectable()
export class RemindersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    @Inject(FOOD_EXTRACTOR) private readonly extractor: FoodExtractor,
  ) {}

  async list(userId: string) {
    const [rows, now] = await Promise.all([
      this.prisma.reminder.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
      this.localNow(userId),
    ]);
    return { reminders: rows.map((r) => toDto(r, now)), max: MAX_REMINDERS };
  }

  async create(userId: string, input: ReminderInput) {
    const crons = checkedCrons(input.crons);
    const count = await this.prisma.reminder.count({ where: { userId } });
    if (count >= MAX_REMINDERS) {
      throw new AppError(
        409,
        `You can have up to ${MAX_REMINDERS} reminders. Delete one to add another.`,
      );
    }
    const row = await this.prisma.reminder.create({
      data: {
        userId,
        title: input.title,
        description: input.description || null,
        crons,
        enabled: input.enabled ?? true,
        prompt: input.prompt || null,
      },
    });
    return toDto(row, await this.localNow(userId));
  }

  async update(userId: string, id: string, input: ReminderUpdateInput) {
    const crons = input.crons === undefined ? undefined : checkedCrons(input.crons);
    const { count } = await this.prisma.reminder.updateMany({
      where: { id, userId },
      data: {
        title: input.title,
        description: input.description === undefined ? undefined : input.description || null,
        crons,
        enabled: input.enabled,
      },
    });
    if (!count) throw notFound("Reminder");
    const [row, now] = await Promise.all([
      this.prisma.reminder.findUniqueOrThrow({ where: { id } }),
      this.localNow(userId),
    ]);
    return toDto(row, now);
  }

  async remove(userId: string, id: string) {
    const { count } = await this.prisma.reminder.deleteMany({ where: { id, userId } });
    if (!count) throw notFound("Reminder");
  }

  /** Words → a draft to review. Nothing is saved. */
  async parse(userId: string, text: string) {
    const tz = await this.users.timezone(userId);
    const used = await this.prisma.aiCall.count({
      where: { userId, type: "REMINDER_PARSE", createdAt: { gte: startOfLocalDay(tz) } },
    });
    if (used >= PARSE_DAILY_CAP) {
      throw new AppError(
        429,
        "That's a lot of reminders for one day. Set this one up by hand, or try tomorrow.",
      );
    }

    const started = Date.now();
    let result: Awaited<ReturnType<FoodExtractor["parseReminder"]>>;
    try {
      result = await this.extractor.parseReminder({ text, localNow: describeNow(tz) });
    } catch (err) {
      await this.prisma.aiCall.create({
        data: {
          userId,
          type: "REMINDER_PARSE",
          provider: this.extractor.name,
          model: "unknown",
          latencyMs: Date.now() - started,
          success: false,
          error: (err instanceof Error ? err.message : String(err)).slice(0, 500),
        },
      });
      throw new AppError(502, "Couldn't set that up right now. Try again in a moment.");
    }
    await this.prisma.aiCall.create({
      data: {
        userId,
        type: "REMINDER_PARSE",
        provider: result.usage.provider,
        model: result.usage.model,
        tokensIn: result.usage.tokensIn,
        tokensOut: result.usage.tokensOut,
        latencyMs: result.usage.latencyMs,
        success: true,
      },
    });

    const draft = result.data;
    if (!draft.isReminder || !draft.crons.length) {
      throw new AppError(
        422,
        'That doesn\'t sound like a reminder. Try "remind me to take creatine every day at 9 am".',
      );
    }
    const parsed = parseRules(draft.crons);
    if (!parsed.ok) {
      throw new AppError(
        422,
        `Couldn't turn that into a schedule: ${parsed.error}. Try saying the day and time, like "every day at 9 am".`,
      );
    }
    const view = scheduleView(parsed.rules, localNowIn(tz));
    return {
      title: draft.title.trim().slice(0, 60) || "Reminder",
      description: draft.description.trim().slice(0, 200) || null,
      crons: view.rules.map((r) => r.cron),
      summary: view.summary,
      rules: view.rules,
      nextAt: view.nextAt,
    };
  }

  private async localNow(userId: string) {
    return localNowIn(await this.users.timezone(userId));
  }
}

/** Valid, canonical crons, or a 400 with the reason. */
function checkedCrons(crons: string[]): string[] {
  const parsed = parseRules(crons);
  if (!parsed.ok) throw new AppError(400, parsed.error);
  return parsed.rules.map(toCron);
}

/** Everything the app shows and schedules for a set of rules, from the user's "now". */
function scheduleView(rules: ReminderRule[], now: LocalDateTime) {
  const nexts = rules
    .flatMap((r) => upcomingTimes(r, now, 1))
    .map(formatLocal)
    .sort();
  return {
    summary: describeRules(rules),
    rules: rules.map((r) => ({
      cron: toCron(r),
      summary: describeRule(r),
      repeating: isRepeating(r),
      weekly:
        r.days.kind === "weekdays" && r.months.length === 12
          ? { minute: r.minute, hours: r.hours, weekdays: r.days.weekdays }
          : null,
    })),
    slots: rules.flatMap(scheduleSlots),
    upcoming: rules
      .filter((r) => !isRepeating(r))
      .flatMap((r) => upcomingTimes(r, now, UPCOMING_PER_RULE))
      .map(formatLocal)
      .sort(),
    nextAt: nexts[0] ?? null,
  };
}

function toDto(row: ReminderRow, now: LocalDateTime) {
  // Stored rules were checked on write; a row that no longer parses (rules tightened) is shown but
  // not scheduled, so the user can fix or delete it.
  const parsed = parseRules(row.crons);
  if (!parsed.ok) {
    return {
      ...row,
      summary: "Schedule needs updating",
      rules: [],
      slots: [],
      upcoming: [],
      nextAt: null,
    };
  }
  const { summary, rules, slots, upcoming, nextAt } = scheduleView(parsed.rules, now);
  return { ...row, summary, rules, slots, upcoming, nextAt };
}

/** The user's wall-clock now, in their profile timezone. */
function localNowIn(tz: string): LocalDateTime {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
  };
}

/** "Monday 16 November 2026, 11:10 pm" in the user's timezone, for the model. */
function describeNow(tz: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: tz,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date());
}
