import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../infra/prisma/prisma.service.js";
import { TargetsService } from "../plan/targets.service.js";
import { UsersService } from "../users/users.service.js";

const DAY = 86_400_000;
const ymd = (d: Date) => d.toISOString().slice(0, 10);

export interface TrendPoint {
  date: string;
  weightKg: number;
  avg7: number; // mean of weigh-ins in the 7 days ending on `date`
}

/** Mean weight of weigh-ins in the 7 days ending on each weigh-in. */
export function sevenDayAverages(metrics: { date: Date; weightKg: number }[]): TrendPoint[] {
  return metrics.map((m) => {
    const from = m.date.getTime() - 6 * DAY;
    const window = metrics.filter(
      (o) => o.date.getTime() >= from && o.date.getTime() <= m.date.getTime(),
    );
    const avg7 = window.reduce((s, o) => s + o.weightKg, 0) / window.length;
    return { date: ymd(m.date), weightKg: m.weightKg, avg7: Math.round(avg7 * 10) / 10 };
  });
}

/** Mean weigh-in within [end − 6 days, end], or null with no data. */
function weekMean(metrics: { date: Date; weightKg: number }[], end: number) {
  const w = metrics.filter((m) => m.date.getTime() <= end && m.date.getTime() > end - 7 * DAY);
  return w.length ? w.reduce((s, m) => s + m.weightKg, 0) / w.length : null;
}

/** Screen 11: weigh-in trend (7-day averages) vs plan, and the last 7 days' stats. */
@Injectable()
export class ProgressService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly targets: TargetsService,
    private readonly users: UsersService,
  ) {}

  /** GET /progress for the user's local today. */
  async get(userId: string) {
    return this.getProgress(userId, await this.users.today(userId));
  }

  /** Weigh-ins, plan line, weekly trend vs plan, last-7-day intake. */
  async getProgress(userId: string, today: Date) {
    const since7 = new Date(today.getTime() - 6 * DAY);
    const [metrics, { plan, goal }, target, meals] = await Promise.all([
      this.prisma.bodyMetric.findMany({ where: { userId }, orderBy: { date: "asc" }, take: 120 }),
      this.targets.computePlan(userId),
      this.targets.currentTarget(userId, today),
      this.prisma.mealLog.groupBy({
        by: ["date"],
        where: { userId, status: "CONFIRMED", date: { gte: since7, lte: today } },
        _sum: { totalKcal: true },
      }),
    ]);

    const points = sevenDayAverages(metrics);
    const thisWeek = weekMean(metrics, today.getTime());
    const lastWeek = weekMean(metrics, today.getTime() - 7 * DAY);
    const weeklyChange = thisWeek != null && lastWeek != null ? thisWeek - lastWeek : null;

    const daysLogged = meals.length;
    const avgIntake = daysLogged
      ? meals.reduce((s, m) => s + (m._sum.totalKcal ?? 0), 0) / daysLogged
      : null;

    return {
      points,
      latest: metrics.at(-1) ?? null,
      plan: {
        startDate: ymd(goal.startDate),
        targetDate: ymd(goal.targetDate),
        startWeightKg: goal.startWeightKg,
        targetWeightKg: plan.targetWeightKg,
        weeklyChangeKg: Math.round(plan.weeklyChangeKg * 100) / 100,
        goalType: goal.type,
      },
      weeklyChange: weeklyChange == null ? null : Math.round(weeklyChange * 100) / 100,
      target: target && {
        kcal: target.kcal,
        reason: target.reason,
        effectiveFrom: ymd(target.effectiveFrom),
      },
      avgIntake: avgIntake == null ? null : Math.round(avgIntake),
      daysLogged,
    };
  }
}

export type Progress = Awaited<ReturnType<ProgressService["getProgress"]>>;
