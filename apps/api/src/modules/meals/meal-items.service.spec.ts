import { describe, expect, it } from "vitest";
import type { PrismaService } from "../../infra/prisma/prisma.service.js";
import { MealItemsService, pickFood } from "./meal-items.service.js";

const tea = {
  id: "food_tea",
  name: "masala chai",
  aliases: [] as string[],
  kcalPer100g: 50,
  proteinPer100g: 2,
  carbsPer100g: 7,
  fatPer100g: 1.5,
  isLiquid: true,
  units: [
    { unit: "cup", grams: 150 },
    { unit: "sachet", grams: 5 },
  ],
};

/** A fake Prisma that knows one food by id and returns it as the only name candidate. */
function service(food: typeof tea | null = tea) {
  const prisma = {
    food: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        food && where.id === food.id ? food : null,
      findMany: async () => (food ? [food] : []),
    },
  } as unknown as PrismaService;
  return new MealItemsService(prisma);
}

describe("MealItemsService.buildItem", () => {
  it("prices a matched food from its standard unit weight", async () => {
    const item = await service().buildItem({
      name: " Masala  Chai ",
      quantity: 2,
      unit: "Cup",
      grams: 100,
    });
    expect(item).toMatchObject({
      foodId: "food_tea",
      name: "masala chai",
      unit: "cup",
      grams: 300,
      kcal: 150,
      approximate: false,
      isLiquid: true,
    });
  });

  it("keeps the caller's grams when trusted", async () => {
    const item = await service().buildItem(
      { name: "chai", quantity: 1, unit: "cup", grams: 120 },
      { trustGrams: true },
    );
    expect(item.grams).toBe(120);
  });

  it('"containers" trusts variable vessels but keeps fixed units standard', async () => {
    const s = service();
    expect(
      (
        await s.buildItem(
          { name: "chai", quantity: 1, unit: "cup", grams: 120 },
          { trustGrams: "containers" },
        )
      ).grams,
    ).toBe(120);
    expect(
      (
        await s.buildItem(
          { name: "chai", quantity: 2, unit: "sachet", grams: 30 },
          { trustGrams: "containers" },
        )
      ).grams,
    ).toBe(10);
  });

  it("falls back to the model's estimate, flagged approximate", async () => {
    const item = await service(null).buildItem({
      name: "Mystery Curry",
      quantity: 1,
      unit: "katori",
      grams: 200,
      per100g: { kcal: 100, protein: 5, carbs: 10, fat: 4 },
      isLiquid: false,
    });
    expect(item).toMatchObject({
      foodId: null,
      name: "mystery curry",
      grams: 200,
      kcal: 200,
      proteinG: 10,
      approximate: true,
    });
    const blank = await service(null).buildItem({ name: "x", quantity: 1, unit: "g", grams: 50 });
    expect(blank).toMatchObject({ kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 });
  });
});

describe("pickFood", () => {
  const f = (name: string, aliases: string[] = []) => ({ name, aliases });
  const coffees = [f("black coffee"), f("latte"), f("cold coffee"), f("filter coffee")];
  const rice = [f("white rice"), f("jeera rice"), f("ghee"), f("roti")];

  it("prefers an exact name or alias", () => {
    expect(pickFood(" Jeera  Rice ", rice)?.name).toBe("jeera rice");
    expect(pickFood("chapati", [f("roti", ["chapati"]), f("plain paratha")])?.name).toBe("roti");
  });

  it("matches the most specific food that ends the detected name", () => {
    expect(pickFood("plain white rice", rice)?.name).toBe("white rice");
    expect(pickFood("tandoori roti", rice)?.name).toBe("roti");
  });

  it("never matches a food that only starts the name", () => {
    // "ghee rice" is a rice dish, not 100 g of ghee.
    expect(pickFood("ghee rice", rice)).toBeNull();
  });

  it("uses a more specific food only when it is the only one", () => {
    expect(pickFood("chai", [f("masala chai"), f("black coffee")])?.name).toBe("masala chai");
    // Black coffee and cold coffee differ several-fold in kcal: don't guess.
    expect(pickFood("coffee", coffees)).toBeNull();
  });

  it("returns null for no candidates or a blank name", () => {
    expect(pickFood("mystery curry", [])).toBeNull();
    expect(pickFood("  ", rice)).toBeNull();
  });
});
