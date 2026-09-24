import { describe, expect, it } from "vitest";
import { formatPortion, mealTitle, mealTypeForHour, nextMealType, unitStep } from "./format";

describe("format", () => {
  it("defaults the meal type by hour", () => {
    expect(mealTypeForHour(8)).toBe("BREAKFAST");
    expect(mealTypeForHour(13)).toBe("LUNCH");
    expect(mealTypeForHour(17)).toBe("SNACK");
    expect(mealTypeForHour(21)).toBe("DINNER");
    expect(mealTypeForHour(2)).toBe("DINNER");
  });

  it("offers the next unlogged main meal from now, then earlier misses", () => {
    expect(nextMealType([], 8)).toBe("BREAKFAST");
    expect(nextMealType(["BREAKFAST"], 8)).toBe("LUNCH");
    expect(nextMealType(["BREAKFAST", "LUNCH"], 13)).toBe("DINNER");
    expect(nextMealType(["LUNCH"], 20)).toBe("DINNER");
    expect(nextMealType(["LUNCH", "DINNER"], 20)).toBe("BREAKFAST");
    expect(nextMealType(["BREAKFAST", "LUNCH", "DINNER"], 20)).toBe("SNACK");
  });

  it("writes portions with grams", () => {
    expect(formatPortion(2, "piece", 80)).toBe("2 pieces · 80 g");
    expect(formatPortion(1, "katori", 150)).toBe("1 katori · 150 g");
    expect(formatPortion(0.5, "katori", 75)).toBe("0.5 katori · 75 g");
    expect(formatPortion(120, "g", 120)).toBe("120 g");
    expect(formatPortion(1, "cup", 180, true)).toBe("1 cup · 180 ml");
    expect(formatPortion(250, "ml", 250, true)).toBe("250 ml");
  });

  it("steps pieces by 1 and katori by 0.5", () => {
    expect(unitStep("piece")).toBe(1);
    expect(unitStep("katori")).toBe(0.5);
  });

  it("sentence-cases meal titles", () => {
    expect(mealTitle(["roti", "dal tadka"], "Photo")).toBe("Roti, dal tadka");
    expect(mealTitle(["roti", "dal tadka", "jeera rice", "sabzi"], "Photo")).toBe(
      "Roti, dal tadka +2 more",
    );
    expect(mealTitle([], "2 roti")).toBe("2 roti");
  });
});
