import { Injectable } from "@nestjs/common";
import type { LogSavedMealInput, SavedMealInput } from "@fitr8/contracts";
import { sumMacros } from "@fitr8/domain/nutrition";
import { AppError, notFound } from "../../common/errors.js";
import { PrismaService } from "../../infra/prisma/prisma.service.js";
import { UsersService } from "../users/users.service.js";
import { MealItemsService, type BuiltItem } from "./meal-items.service.js";
import { MealsService } from "./meals.service.js";

/** Saved meals per account; plenty for real repeat meals, and keeps the picker readable. */
export const MAX_SAVED_MEALS = 50;

const withItems = { items: { orderBy: { position: "asc" as const } } };

/**
 * A user's own repeat meals ("My breakfast"): items priced once when saved, logged with one tap.
 * Logging copies the saved items into a new confirmed meal — no AI call, no scan used.
 */
@Injectable()
export class SavedMealsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly items: MealItemsService,
    private readonly meals: MealsService,
  ) {}

  /** Most recently logged first, then newest; never-logged meals after logged ones. */
  async list(userId: string) {
    const rows = await this.prisma.savedMeal.findMany({
      where: { userId },
      include: withItems,
      orderBy: [{ lastLoggedAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
    });
    return { savedMeals: rows.map(toDto) };
  }

  async create(userId: string, input: SavedMealInput) {
    await this.assertRoom(userId);
    const built = await this.build(userId, input.items);
    const row = await this.prisma.savedMeal.create({
      data: {
        userId,
        name: input.name,
        mealType: input.mealType ?? null,
        ...totalsOf(built),
        items: { create: built.map((item, position) => ({ ...item, position })) },
      },
      include: withItems,
    });
    return toDto(row);
  }

  /** Replace name, slot and items. */
  async update(userId: string, id: string, input: SavedMealInput) {
    await this.owned(userId, id);
    const built = await this.build(userId, input.items);
    const [, , row] = await this.prisma.$transaction([
      this.prisma.savedMealItem.deleteMany({ where: { savedMealId: id } }),
      this.prisma.savedMealItem.createMany({
        data: built.map((item, position) => ({ ...item, position, savedMealId: id })),
      }),
      this.prisma.savedMeal.update({
        where: { id },
        data: { name: input.name, mealType: input.mealType ?? null, ...totalsOf(built) },
        include: withItems,
      }),
    ]);
    return toDto(row);
  }

  async remove(userId: string, id: string) {
    const { count } = await this.prisma.savedMeal.deleteMany({ where: { id, userId } });
    if (!count) throw notFound("Saved meal");
  }

  /** One tap: a confirmed meal from the saved items, today or a recent `date`. */
  async log(userId: string, id: string, { mealType, date }: LogSavedMealInput) {
    const day = await this.users.mealDate(userId, date); // 400 before anything is written
    const saved = await this.owned(userId, id);
    const items: BuiltItem[] = saved.items.map(
      ({ id: _id, savedMealId: _s, position: _p, ...item }) => item,
    );
    const log = await this.meals.createConfirmed(userId, {
      mealType,
      date: day,
      source: "TEXT",
      items,
    });
    await this.prisma.savedMeal.update({
      where: { id },
      data: { timesLogged: { increment: 1 }, lastLoggedAt: new Date() },
    });
    return { id: log.id };
  }

  private async owned(userId: string, id: string) {
    const row = await this.prisma.savedMeal.findFirst({
      where: { id, userId },
      include: withItems,
    });
    if (!row) throw notFound("Saved meal");
    return row;
  }

  private async assertRoom(userId: string) {
    const count = await this.prisma.savedMeal.count({ where: { userId } });
    if (count >= MAX_SAVED_MEALS) {
      throw new AppError(
        409,
        `You can save up to ${MAX_SAVED_MEALS} meals. Delete one to save another.`,
      );
    }
  }

  /** Price items like meal review does; a food id must be one this user may see. */
  private async build(userId: string, input: SavedMealInput["items"]) {
    const ids = [...new Set(input.flatMap((i) => (i.foodId ? [i.foodId] : [])))];
    if (ids.length) {
      const visible = await this.prisma.food.count({
        where: {
          id: { in: ids },
          OR: [{ source: { not: "LABEL_SCAN" } }, { verified: true }, { submittedById: userId }],
        },
      });
      if (visible !== ids.length) throw notFound("Food");
    }
    return Promise.all(input.map((i) => this.items.buildItem(i, { trustGrams: true })));
  }
}

function totalsOf(items: BuiltItem[]) {
  const t = sumMacros(items);
  return { totalKcal: t.kcal, totalProtein: t.proteinG, totalCarbs: t.carbsG, totalFat: t.fatG };
}

type Row = Awaited<ReturnType<SavedMealsService["owned"]>>;

function toDto(row: Row) {
  return {
    id: row.id,
    name: row.name,
    mealType: row.mealType,
    kcal: Math.round(row.totalKcal),
    proteinG: Math.round(row.totalProtein),
    carbsG: Math.round(row.totalCarbs),
    fatG: Math.round(row.totalFat),
    timesLogged: row.timesLogged,
    lastLoggedAt: row.lastLoggedAt,
    createdAt: row.createdAt,
    items: row.items.map((i) => ({
      id: i.id,
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
  };
}
