import { Injectable } from "@nestjs/common";
import type { MealTypeValue } from "@fitr8/contracts";
import { PrismaService } from "../../infra/prisma/prisma.service.js";
import { UsersService } from "../users/users.service.js";

const DAY = 86_400_000;

/** Same foods in the same amounts = the same "usual", whatever meal slot it was logged in. */
export function usualSignature(items: { name: string; quantity: number; unit: string }[]) {
  return items
    .map((i) => `${i.name}|${i.quantity}|${i.unit}`)
    .sort()
    .join(";");
}

@Injectable()
export class UsualsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
  ) {}

  /**
   * Design 7b "Your usuals": the confirmed meals a user logs most, newest first on ties.
   * Relogging one copies it without an AI call.
   */
  async getUsuals(userId: string, limit = 6) {
    const meals = await this.prisma.mealLog.findMany({
      where: { userId, status: "CONFIRMED", createdAt: { gte: new Date(Date.now() - 60 * DAY) } },
      include: { items: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    const groups = new Map<string, { meal: (typeof meals)[number]; count: number }>();
    for (const m of meals) {
      if (!m.items.length) continue;
      const key = usualSignature(m.items);
      const g = groups.get(key);
      if (g) g.count++;
      else groups.set(key, { meal: m, count: 1 });
    }

    return [...groups.values()]
      .sort((a, b) => b.count - a.count || +b.meal.createdAt - +a.meal.createdAt)
      .slice(0, limit)
      .map(({ meal, count }) => ({
        mealId: meal.id,
        mealType: meal.mealType,
        count,
        names: meal.items.map((i) => i.name),
        kcal: Math.round(meal.totalKcal),
        proteinG: Math.round(meal.totalProtein),
        carbsG: Math.round(meal.totalCarbs),
      }));
  }

  /** Copy a past confirmed meal into today as a new confirmed meal. No AI, no scan used. Null if not the user's. */
  async relogMeal(userId: string, sourceMealId: string, mealType: MealTypeValue) {
    const source = await this.prisma.mealLog.findFirst({
      where: { id: sourceMealId, userId, status: "CONFIRMED" },
      include: { items: true },
    });
    if (!source) return null;

    return this.prisma.mealLog.create({
      data: {
        userId,
        date: await this.users.today(userId),
        mealType,
        source: "TEXT",
        status: "CONFIRMED",
        confirmedAt: new Date(),
        note: source.note,
        totalKcal: source.totalKcal,
        totalProtein: source.totalProtein,
        totalCarbs: source.totalCarbs,
        totalFat: source.totalFat,
        items: {
          create: source.items.map((i) => ({
            foodId: i.foodId,
            name: i.name,
            quantity: i.quantity,
            unit: i.unit,
            grams: i.grams,
            kcal: i.kcal,
            proteinG: i.proteinG,
            carbsG: i.carbsG,
            fatG: i.fatG,
            approximate: i.approximate,
            isLiquid: i.isLiquid,
          })),
        },
      },
    });
  }
}

export type Usual = Awaited<ReturnType<UsualsService["getUsuals"]>>[number];
