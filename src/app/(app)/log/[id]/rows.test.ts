import { describe, expect, it } from "vitest";
import { ConfirmMealSchema } from "@/lib/validators";
import { fromItems, rowFromFood, scaleRow, toConfirmPayload, totals, type ItemDto } from "./rows";

const item = (over: Partial<ItemDto>): ItemDto => ({
  id: "i1",
  foodId: "f1",
  name: "roti",
  quantity: 2,
  unit: "piece",
  grams: 80,
  kcal: 211.2,
  proteinG: 7.1,
  carbsG: 36.8,
  fatG: 4,
  aiConfidence: 0.9,
  approximate: false,
  ...over,
});

describe("confirm rows", () => {
  it("pulls a saved 1 tsp ghee item into the switch", () => {
    const { rows, ghee } = fromItems([
      item({}),
      item({ id: "g", name: "ghee", quantity: 1, unit: "tsp", grams: 5, kcal: 45 }),
    ]);
    expect(ghee).toBe(true);
    expect(rows.map((r) => r.name)).toEqual(["roti"]);
  });

  it("keeps a larger ghee portion as a normal row", () => {
    const { rows, ghee } = fromItems([item({ name: "ghee", quantity: 2, unit: "tsp" })]);
    expect(ghee).toBe(false);
    expect(rows).toHaveLength(1);
  });

  it("scales grams and macros with quantity", () => {
    const [row] = fromItems([item({})]).rows;
    const three = scaleRow(row, 3);
    expect(three.grams).toBe(120);
    expect(three.kcal).toBeCloseTo(316.8);
    expect(three.fatG).toBeCloseTo(6);
  });

  it("adds 45 kcal and 5 g fat for the ghee switch", () => {
    const { rows } = fromItems([item({})]);
    const off = totals(rows, false);
    const on = totals(rows, true);
    expect(on.kcal - off.kcal).toBe(45);
    expect(on.fatG - off.fatG).toBe(5);
  });

  it("builds a food row from per-100 g values", () => {
    const row = rowFromFood(
      { id: "dal", name: "dal tadka", per100g: { kcal: 120, protein: 6, carbs: 15, fat: 4 } },
      { unit: "katori", grams: 150 },
    );
    expect(row.kcal).toBe(180);
    expect(row.proteinG).toBe(9);
  });

  it("produces a payload the API accepts", () => {
    const { rows } = fromItems([item({ grams: 0.4 })]);
    const payload = toConfirmPayload(rows, true);
    expect(payload.items.at(-1)).toMatchObject({ name: "ghee", unit: "tsp", grams: 5 });
    expect(payload.items[0].grams).toBe(1);
    expect(ConfirmMealSchema.safeParse(payload).success).toBe(true);
  });
});
