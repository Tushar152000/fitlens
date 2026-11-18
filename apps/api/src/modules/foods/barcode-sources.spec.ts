import { describe, expect, it } from "vitest";
import type { Env } from "../../config/config.module.js";
import {
  barcodeSources,
  mapEdamam,
  mapFatSecret,
  mapOff,
  mapUpcItemDb,
  mapUsda,
  sameGtin,
} from "./barcode-sources.js";

describe("mapOff", () => {
  it("keeps the name, brand and photo when nutrition is missing", () => {
    expect(
      mapOff({
        product_name: "Bhujia",
        brands: "Haldiram's, X",
        image_front_url: "https://img",
        nutriments: {},
      }),
    ).toEqual({
      draft: null,
      meta: { name: "Bhujia", brand: "Haldiram's", imageUrl: "https://img" },
    });
  });
  it("is empty without a name", () => {
    expect(mapOff({ nutriments: { "energy-kcal_100g": 1 } })).toEqual({ draft: null, meta: null });
  });
});

describe("mapUsda", () => {
  const food = {
    description: "PEANUT BUTTER",
    brandOwner: "Acme",
    gtinUpc: "0012345678905",
    servingSize: 32,
    servingSizeUnit: "g",
    householdServingFullText: "2 Tbsp",
    foodNutrients: [
      { nutrientId: 1008, value: 594 },
      { nutrientId: 1003, value: 21.9 },
      { nutrientId: 1005, value: 21.9 },
      { nutrientId: 1004, value: 50 },
      { nutrientId: 2000, value: 9.4 },
      { nutrientId: 1093, value: 469 },
    ],
  };
  it("maps branded per-100 g nutrients", () => {
    expect(mapUsda(food).draft).toEqual({
      name: "PEANUT BUTTER",
      brand: "Acme",
      servingSizeG: 32,
      servingLabel: "2 Tbsp",
      imageUrl: null,
      kcalPer100g: 594,
      proteinPer100g: 21.9,
      carbsPer100g: 21.9,
      fatPer100g: 50,
      sugarPer100g: 9.4,
      sodiumMgPer100g: 469,
      isLiquid: false,
    });
  });
  it("reads legacy nutrient numbers and flags millilitre servings as liquid", () => {
    const drink = mapUsda({
      description: "COLA",
      servingSize: 355,
      servingSizeUnit: "MLT",
      foodNutrients: [
        { nutrientNumber: "208", value: 42 },
        { nutrientNumber: "203", value: 0 },
        { nutrientNumber: "205", value: 10.6 },
        { nutrientNumber: "204", value: 0 },
      ],
    }).draft;
    expect(drink).toMatchObject({
      kcalPer100g: 42,
      carbsPer100g: 10.6,
      isLiquid: true,
      servingSizeG: 355,
    });
  });
});

describe("mapFatSecret", () => {
  it("scales a metric serving to 100 g", () => {
    const { draft } = mapFatSecret({
      food_name: "Marie Gold",
      brand_name: "Britannia",
      servings: {
        serving: [
          { metric_serving_unit: "oz", metric_serving_amount: "1" },
          {
            serving_description: "4 biscuits",
            metric_serving_amount: "25.000",
            metric_serving_unit: "g",
            calories: "110",
            protein: "2",
            carbohydrate: "19",
            fat: "3",
            sugar: "5",
            sodium: "90",
          },
        ],
      },
    });
    expect(draft).toMatchObject({
      name: "Marie Gold",
      brand: "Britannia",
      servingSizeG: 25,
      kcalPer100g: 440,
      proteinPer100g: 8,
      carbsPer100g: 76,
      fatPer100g: 12,
      sugarPer100g: 20,
      sodiumMgPer100g: 360,
    });
  });
  it("keeps the name when no serving has a gram/ml weight", () => {
    expect(
      mapFatSecret({ food_name: "Tea", servings: { serving: { metric_serving_unit: "cup" } } }),
    ).toEqual({
      draft: null,
      meta: { name: "Tea", brand: null, imageUrl: null },
    });
  });
});

describe("mapEdamam", () => {
  it("maps per-100 g nutrients", () => {
    expect(
      mapEdamam({
        label: "Oats",
        brand: "Saffola",
        image: "https://e/img.jpg",
        nutrients: { ENERC_KCAL: 389, PROCNT: 13, CHOCDF: 66, FAT: 7 },
      }).draft,
    ).toMatchObject({
      name: "Oats",
      brand: "Saffola",
      kcalPer100g: 389,
      imageUrl: "https://e/img.jpg",
    });
  });
});

describe("mapUpcItemDb", () => {
  it("gives a name and photo, never nutrition", () => {
    expect(
      mapUpcItemDb({ title: "Maggi Masala", brand: "Nestle", images: ["https://u/1.jpg"] }),
    ).toEqual({
      draft: null,
      meta: { name: "Maggi Masala", brand: "Nestle", imageUrl: "https://u/1.jpg" },
    });
  });
});

describe("sameGtin", () => {
  it("ignores leading zeros", () => {
    expect(sameGtin("0012345678905", "012345678905")).toBe(true);
    expect(sameGtin("8901234567890", "8901234567891")).toBe(false);
  });
});

describe("barcodeSources", () => {
  const env = (extra: Partial<Env>) => ({ OFF_CONTACT: undefined, ...extra }) as Env;
  it("uses only Open Food Facts without keys", () => {
    expect(barcodeSources(env({})).map((s) => s.name)).toEqual(["OPEN_FOOD_FACTS"]);
  });
  it("turns each source on with its keys, most trusted first", () => {
    expect(
      barcodeSources(
        env({
          USDA_FDC_API_KEY: "k",
          FATSECRET_CLIENT_ID: "i",
          FATSECRET_CLIENT_SECRET: "s",
          EDAMAM_APP_ID: "a",
          EDAMAM_APP_KEY: "b",
          UPCITEMDB_ENABLED: true,
        }),
      ).map((s) => s.name),
    ).toEqual(["OPEN_FOOD_FACTS", "FATSECRET", "USDA", "EDAMAM", "UPCITEMDB"]);
  });
  it("needs both halves of a key pair", () => {
    expect(
      barcodeSources(env({ FATSECRET_CLIENT_ID: "i", EDAMAM_APP_KEY: "b" })).map((s) => s.name),
    ).toEqual(["OPEN_FOOD_FACTS"]);
  });
});
