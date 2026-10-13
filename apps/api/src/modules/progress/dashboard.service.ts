import { Injectable } from "@nestjs/common";
import { localDate } from "@fitr8/domain/dates";
import { sumMacros } from "@fitr8/domain/nutrition";
import { PrismaService } from "../../infra/prisma/prisma.service.js";
import { StorageService } from "../../infra/storage/storage.service.js";
import { TargetsService } from "../plan/targets.service.js";
import { UsersService } from "../users/users.service.js";

const DAY_MS = 86_400_000;

/** Screen 6 (Today): the day's targets, meals and totals, plus the logging streak. */
@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly targets: TargetsService,
    private readonly storage: StorageService,
    private readonly users: UsersService,
  ) {}

  /** GET /dashboard for one date: the day's targets and meals (with 1 h photo links), streak and timezone. */
  async getDay(userId: string, date: Date) {
    const timezone = await this.users.timezone(userId);
    const today = localDate(timezone);
    const [day, streak] = await Promise.all([
      this.dayTotals(userId, date),
      this.loggingStreak(userId, today),
    ]);
    const meals = await Promise.all(
      day.meals.map(async (m) => ({
        ...m,
        aiRaw: undefined, // raw model output isn't needed on the dashboard
        photoUrl: await this.storage.presignReadOrNull(m.photoKey, 3600),
      })),
    );
    return { ...day, meals, streak, timezone };
  }

  /** Target, confirmed totals and every meal (any status) for the date. */
  async dayTotals(userId: string, date: Date) {
    const [target, meals] = await Promise.all([
      this.targets.currentTarget(userId, date),
      this.prisma.mealLog.findMany({
        where: { userId, date },
        include: { items: true },
        orderBy: { createdAt: "asc" },
      }),
    ]);

    const confirmed = meals.filter((m) => m.status === "CONFIRMED");
    const eaten = sumMacros(
      confirmed.map((m) => ({
        kcal: m.totalKcal,
        proteinG: m.totalProtein,
        carbsG: m.totalCarbs,
        fatG: m.totalFat,
      })),
    );

    return {
      date: date.toISOString().slice(0, 10),
      target: target && {
        kcal: target.kcal,
        proteinG: target.proteinG,
        carbsG: target.carbsG,
        fatG: target.fatG,
        reason: target.reason,
      },
      eaten,
      remainingKcal: target ? Math.round(target.kcal - eaten.kcal) : null,
      meals,
    };
  }

  /**
   * Consecutive days with at least one confirmed meal, ending today — or yesterday, so the
   * streak doesn't read 0 before breakfast is logged.
   */
  async loggingStreak(userId: string, today: Date): Promise<number> {
    const rows = await this.prisma.mealLog.findMany({
      where: {
        userId,
        status: "CONFIRMED",
        date: { lte: today, gte: new Date(today.getTime() - 365 * DAY_MS) },
      },
      select: { date: true },
      distinct: ["date"],
      orderBy: { date: "desc" },
    });
    const days = new Set(rows.map((r) => r.date.getTime()));
    let cursor = days.has(today.getTime()) ? today.getTime() : today.getTime() - DAY_MS;
    let streak = 0;
    while (days.has(cursor)) {
      streak++;
      cursor -= DAY_MS;
    }
    return streak;
  }
}

export type DashboardDay = Awaited<ReturnType<DashboardService["getDay"]>>;
