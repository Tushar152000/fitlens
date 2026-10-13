import { Injectable } from "@nestjs/common";
import type { HistoryDayDto } from "@fitr8/contracts";
import { mealTitle } from "@fitr8/domain/format";
import { PrismaService } from "../../infra/prisma/prisma.service.js";

const DAY = 86_400_000;
const ymd = (d: Date) => d.toISOString().slice(0, 10);

@Injectable()
export class HistoryService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Design 12: daily totals for the last `days` days ending `today` (a local-date UTC midnight),
   * with each day's target and confirmed meals. Averages use full days only (today is excluded).
   */
  async getHistory(userId: string, days: 7 | 30, today: Date) {
    const from = new Date(today.getTime() - (days - 1) * DAY);
    const [meals, targets] = await Promise.all([
      this.prisma.mealLog.findMany({
        where: { userId, status: "CONFIRMED", date: { gte: from, lte: today } },
        include: { items: { select: { name: true } } },
        orderBy: { createdAt: "asc" },
      }),
      this.prisma.dailyTarget.findMany({
        where: { userId, effectiveFrom: { lte: today } },
        orderBy: [{ effectiveFrom: "asc" }, { createdAt: "asc" }],
        select: { effectiveFrom: true, kcal: true },
      }),
    ]);

    const targetOn = (date: Date) => {
      let kcal: number | null = null;
      for (const t of targets) if (t.effectiveFrom.getTime() <= date.getTime()) kcal = t.kcal;
      return kcal;
    };

    const result: HistoryDayDto[] = [];
    for (let i = 0; i < days; i++) {
      const date = new Date(from.getTime() + i * DAY);
      const key = ymd(date);
      const dayMeals = meals.filter((m) => ymd(m.date) === key);
      result.push({
        date: key,
        kcal: Math.round(dayMeals.reduce((s, m) => s + m.totalKcal, 0)),
        proteinG: Math.round(dayMeals.reduce((s, m) => s + m.totalProtein, 0)),
        target: targetOn(date),
        logged: dayMeals.length > 0,
        isToday: key === ymd(today),
        meals: dayMeals.map((m) => ({
          id: m.id,
          mealType: m.mealType,
          title: mealTitle(
            m.items.map((it) => it.name),
            m.inputText ?? "Meal",
          ),
          kcal: Math.round(m.totalKcal),
          createdAt: m.createdAt.toISOString(),
        })),
      });
    }

    const full = result.filter((d) => d.logged && !d.isToday);
    return {
      days: result,
      daysLogged: result.filter((d) => d.logged).length,
      avgKcalFullDays: full.length
        ? Math.round(full.reduce((s, d) => s + d.kcal, 0) / full.length)
        : null,
    };
  }
}

export type History = Awaited<ReturnType<HistoryService["getHistory"]>>;
