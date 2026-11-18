import { describe, expect, it } from "vitest";
import { isNonVegIngredient, splitName, toFood, unitsFor } from "./indb-convert.js";

describe("splitName", () => {
  it("turns bracketed names and slash spellings into aliases", () => {
    expect(splitName("Plain khitchdi (Plain khichri/khichdi)")).toEqual({
      name: "plain khitchdi",
      aliases: ["plain khichri", "plain khichdi"],
    });
    expect(splitName("Mutton biryani/biriyani")).toEqual({
      name: "mutton biryani",
      aliases: ["mutton biriyani"],
    });
  });
  it("folds a describing word into the name instead of making it an alias", () => {
    expect(splitName("Lassi (Salted)")).toEqual({ name: "salted lassi", aliases: [] });
  });
  it("never keeps a generic word as an alias", () => {
    expect(splitName("Aloo gobhi (Curry)").aliases).toEqual([]);
  });
});

describe("unitsFor", () => {
  it("maps INDB units to the units the meal parser uses", () => {
    expect(unitsFor("Tablespoon")).toEqual(["tbsp"]);
    expect(unitsFor("tall glass")).toEqual(["glass", "tall glass"]);
    expect(unitsFor("idli")).toEqual(["idli", "piece"]);
    expect(unitsFor("")).toEqual([]);
  });
});

describe("isNonVegIngredient", () => {
  it("uses IFCT groups and ingredient words, without catching eggplant", () => {
    expect(isNonVegIngredient("M001", "Egg, poultry, whole, raw")).toBe(true);
    expect(isNonVegIngredient("K506", "Stock cubes, chicken")).toBe(true);
    expect(isNonVegIngredient("D012", "Eggplant")).toBe(false);
    expect(isNonVegIngredient("L002", "Milk, whole, Cow")).toBe(false);
  });
});

describe("toFood", () => {
  const row = {
    food_code: "BFP147",
    food_name: "Instant idli (with semolina)",
    energy_kcal: 137.5,
    protein_g: 5.1,
    carb_g: 24.1,
    fat_g: 2,
    fibre_g: 4,
    freesugar_g: 1.9,
    sodium_mg: 300,
    servings_unit: "idli",
    unit_serving_energy_kcal: 34.375,
  };
  it("derives the serving weight from per-serving / per-100 g", () => {
    expect(toFood(row, new Set())).toMatchObject({
      name: "instant idli with semolina",
      veg: true,
      serving: { label: "1 idli", grams: 25 },
      units: { serving: 25, idli: 25, piece: 25 },
    });
  });
  it("drops weight units and whole-dish servings as portions", () => {
    expect(toFood({ ...row, servings_unit: "gm" }, new Set())!.serving).toBeNull();
    expect(toFood({ ...row, unit_serving_energy_kcal: 2000 }, new Set())!.units).toEqual({});
  });
  it("flags recipes with a non-veg ingredient", () => {
    expect(toFood(row, new Set(["BFP147"]))!.veg).toBe(false);
  });
});
