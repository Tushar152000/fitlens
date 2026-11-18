import { Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@fitr8/db";
import type { DeleteAccountInput, PreferredNameInput, RemindersInput } from "@fitr8/contracts";
import { isWelcomeBack, shouldTouchActivity } from "@fitr8/domain/activity";
import { localDate, mealDateProblem, parseDateOnly } from "@fitr8/domain/dates";
import { ageFromBirthDate } from "@fitr8/domain/nutrition";
import { PHONE_TAKEN } from "@fitr8/domain/person";
import { AppError, notFound } from "../../common/errors.js";
import { PrismaService } from "../../infra/prisma/prisma.service.js";
import { StorageService } from "../../infra/storage/storage.service.js";
import { BillingService } from "../billing/billing.service.js";

export const DEFAULT_TIMEZONE = "Asia/Kolkata";

export interface NewUser {
  email: string;
  name: string | null;
  image: string | null;
  emailVerified: Date | null;
}

/** One CSV cell, quoted when it holds a quote, comma or newline. */
export const csvCell = (v: unknown) => {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Identity and per-user settings every other module needs (timezone → the user's "today"). */
@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly billing: BillingService,
  ) {}

  async timezone(userId: string): Promise<string> {
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
      select: { timezone: true },
    });
    return profile?.timezone ?? DEFAULT_TIMEZONE;
  }

  /** The user's local calendar date as a UTC-midnight Date (for @db.Date columns). */
  async today(userId: string): Promise<Date> {
    return localDate(await this.timezone(userId));
  }

  /**
   * The day a meal is logged on: `ymd` when given (a forgotten meal, up to MEAL_BACKFILL_DAYS back),
   * else today. 400 for a future day or one too far back.
   */
  async mealDate(userId: string, ymd?: string): Promise<Date> {
    const today = await this.today(userId);
    if (!ymd) return today;
    const date = parseDateOnly(ymd);
    const problem = mealDateProblem(date, today);
    if (problem) throw new AppError(400, problem);
    return date;
  }

  /** The user with this (lower-cased) email, if any. Used by sign-in to link a new identity. */
  async findIdByEmail(email: string): Promise<string | null> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: { id: true },
    });
    return user?.id ?? null;
  }

  /** A new account. Throws Prisma P2002 if the email was taken meanwhile (the caller retries). */
  async create(input: NewUser): Promise<string> {
    const user = await this.prisma.user.create({
      data: {
        email: input.email.toLowerCase(),
        name: input.name,
        image: input.image,
        emailVerified: input.emailVerified,
      },
      select: { id: true },
    });
    return user.id;
  }

  /** Fills name, avatar and email verification from a sign-in where they're still empty; never overwrites. */
  async fillMissing(userId: string, from: Partial<Omit<NewUser, "email">>) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, image: true, emailVerified: true },
    });
    if (!user) return;
    const data = {
      ...(!user.name && from.name ? { name: from.name } : {}),
      ...(!user.image && from.image ? { image: from.image } : {}),
      ...(!user.emailVerified && from.emailVerified ? { emailVerified: from.emailVerified } : {}),
    };
    if (Object.keys(data).length) await this.prisma.user.update({ where: { id: userId }, data });
  }

  /**
   * The app's launch call. Also records the visit (hourly at most) as activity, except while a
   * "welcome back" is pending, so that prompt survives restarts until it is answered or dismissed.
   */
  async me(userId: string, now = new Date()) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        lastName: true,
        phone: true,
        email: true,
        image: true,
        lastActiveAt: true,
        profile: true,
      },
    });
    const { profile, lastActiveAt, ...rest } = user;
    const activity = { onboardedAt: profile?.onboardedAt ?? null, lastActiveAt };
    if (shouldTouchActivity(activity, now)) await this.markActive(userId, now);
    const plan = await this.billing.plan(userId);
    return {
      ...rest,
      onboarded: Boolean(profile?.onboardedAt),
      welcomeBack: isWelcomeBack(activity, now),
      profile,
      plan,
    };
  }

  /**
   * The profile facts the coach personalises with: who the user is and how they train. Null before
   * onboarding. No contact details (email, phone) — the coach never needs them.
   */
  async coachProfile(userId: string, now = new Date()) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, profile: true },
    });
    const p = user?.profile;
    if (!p) return null;
    return {
      name: user.name,
      sex: p.sex,
      age: ageFromBirthDate(p.birthDate, now),
      heightCm: p.heightCm,
      activityLevel: p.activityLevel,
      dietType: p.dietType,
      experience: p.experience,
      equipment: p.equipment,
      trainingDaysPerWeek: p.trainingDaysPerWeek,
      sessionMinutes: p.sessionMinutes,
      injuries: p.injuries,
      medicalFlag: p.medicalFlag,
      medicalNote: p.medicalFlag ? p.medicalNote : null,
      timezone: p.timezone,
    };
  }

  /** The user is here now: ends a pending "welcome back" (answered, or "Not now"). */
  async markActive(userId: string, now = new Date()) {
    await this.prisma.user.update({ where: { id: userId }, data: { lastActiveAt: now } });
  }

  /**
   * Onboarding step 1: first name, last name, phone. Google sign-in won't overwrite them. Omitted
   * fields stay as they are; a null phone clears it.
   */
  async setName(userId: string, { name, lastName, phone }: PreferredNameInput) {
    if (phone && !(await this.phoneAvailable(userId, phone))) throw new AppError(409, PHONE_TAKEN);
    try {
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          name,
          ...(lastName !== undefined ? { lastName } : {}),
          ...(phone !== undefined ? { phone } : {}),
        },
      });
    } catch (err) {
      // Someone else saved the same number between the check and the write.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002")
        throw new AppError(409, PHONE_TAKEN);
      throw err;
    }
    return this.me(userId);
  }

  /** True unless another account has this E.164 number (your own counts as available). */
  async phoneAvailable(userId: string, phone: string): Promise<boolean> {
    const owner = await this.prisma.user.findUnique({ where: { phone }, select: { id: true } });
    return !owner || owner.id === userId;
  }

  /** Save the design-13 reminder switches (lunch, dinner, water). */
  async setReminders(userId: string, { lunch, dinner, water }: RemindersInput) {
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
      select: { userId: true },
    });
    if (!profile) throw new AppError(404, "Finish onboarding first");
    return this.prisma.profile.update({
      where: { userId },
      data: {
        ...(lunch !== undefined ? { remindLunch: lunch } : {}),
        ...(dinner !== undefined ? { remindDinner: dinner } : {}),
        ...(water !== undefined ? { remindWater: water } : {}),
      },
      select: { remindLunch: true, remindDinner: true, remindWater: true },
    });
  }

  /**
   * Design 13 "Export CSV": every confirmed meal item plus weigh-ins, as one CSV document.
   * Read-only over the meals and progress tables; the user's own rows only.
   */
  async exportCsv(userId: string): Promise<{ filename: string; csv: string }> {
    const [meals, metrics] = await Promise.all([
      this.prisma.mealLog.findMany({
        where: { userId, status: "CONFIRMED" },
        include: { items: true },
        orderBy: [{ date: "asc" }, { createdAt: "asc" }],
      }),
      this.prisma.bodyMetric.findMany({ where: { userId }, orderBy: { date: "asc" } }),
    ]);

    const rows = [
      [
        "type",
        "date",
        "meal",
        "item",
        "quantity",
        "unit",
        "grams",
        "kcal",
        "protein_g",
        "carbs_g",
        "fat_g",
        "note",
      ],
    ];
    for (const m of meals) {
      for (const i of m.items) {
        rows.push([
          "meal_item",
          m.date.toISOString().slice(0, 10),
          m.mealType.toLowerCase(),
          i.name,
          String(i.quantity),
          i.unit,
          String(Math.round(i.grams)),
          String(Math.round(i.kcal)),
          String(Math.round(i.proteinG * 10) / 10),
          String(Math.round(i.carbsG * 10) / 10),
          String(Math.round(i.fatG * 10) / 10),
          m.note ?? "",
        ]);
      }
    }
    for (const b of metrics) {
      rows.push([
        "weigh_in",
        b.date.toISOString().slice(0, 10),
        "",
        "weight_kg",
        String(b.weightKg),
        "kg",
        "",
        "",
        "",
        "",
        "",
        b.waistCm != null ? `waist ${b.waistCm} cm` : "",
      ]);
    }

    return {
      filename: `fitr8-export-${new Date().toISOString().slice(0, 10)}.csv`,
      csv: rows.map((r) => r.map(csvCell).join(",")).join("\n") + "\n",
    };
  }

  /**
   * Removes the user and everything tied to it (all relations cascade), then their photos in
   * storage. A storage failure is logged, never blocks the deletion: the rows are already gone.
   */
  /**
   * Deletes the user and everything they own. Any reasons or feedback are kept in the same
   * transaction, with no link to the user: only how many days the account existed.
   */
  async deleteAccount(userId: string, { reasons, feedback }: DeleteAccountInput = { reasons: [] }) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { createdAt: true },
    });
    if (!user) throw notFound("User");
    const said = reasons.length > 0 || Boolean(feedback);
    await this.prisma.$transaction([
      ...(said
        ? [
            this.prisma.accountDeletionFeedback.create({
              data: {
                reasons,
                feedback: feedback || null,
                accountAgeDays: Math.floor((Date.now() - user.createdAt.getTime()) / 86_400_000),
              },
            }),
          ]
        : []),
      this.prisma.user.delete({ where: { id: userId } }),
    ]);
    await this.storage
      .deleteUserPhotos(userId)
      .catch((err) =>
        this.logger.error(
          `Photos of deleted user ${userId} not removed: ${err instanceof Error ? err.message : err}`,
        ),
      );
  }
}
