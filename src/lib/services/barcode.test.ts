import { describe, expect, it } from "vitest";
import { mapOffProduct } from "./barcode";

describe("mapOffProduct", () => {
  it("maps Open Food Facts nutriments per 100 g", () => {
    const draft = mapOffProduct({
      product_name: "Centre Filled Cookies",
      brands: "Hide & Seek, Parle",
      serving_size: "1 portion (30 g)",
      serving_quantity: 30,
      nutriments: {
        "energy-kcal_100g": 536.97,
        proteins_100g: 4.333,
        carbohydrates_100g: 63.333,
        fat_100g: 29.333,
        sugars_100g: 33.667,
        sodium_100g: 0.12,
      },
    });
    expect(draft).toMatchObject({
      name: "Centre Filled Cookies",
      brand: "Hide & Seek",
      servingSizeG: 30,
      kcalPer100g: 537,
      proteinPer100g: 4.3,
      sodiumMgPer100g: 120,
      isLiquid: false,
    });
  });

  it("falls back to kJ and flags drinks served in ml", () => {
    const draft = mapOffProduct({
      product_name: "Diet Coke",
      serving_size: "330 ml",
      nutriments: { energy_100g: 1.7, proteins_100g: 0, carbohydrates_100g: 0, fat_100g: 0 },
    });
    expect(draft?.kcalPer100g).toBeCloseTo(0.4, 1);
    expect(draft?.isLiquid).toBe(true);
  });

  it("returns null without usable nutrition", () => {
    expect(mapOffProduct({ product_name: "Mystery", nutriments: {} })).toBeNull();
    expect(
      mapOffProduct({
        nutriments: {
          "energy-kcal_100g": 100,
          proteins_100g: 1,
          carbohydrates_100g: 1,
          fat_100g: 1,
        },
      }),
    ).toBeNull();
  });
});
