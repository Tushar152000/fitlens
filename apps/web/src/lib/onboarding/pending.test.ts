import { describe, expect, it } from "vitest";
import { draftFromCalculator, parseCalculator } from "./pending";

describe("calculator handoff", () => {
  const good = {
    goal: "FAT_LOSS",
    sex: "MALE",
    ageYears: 29,
    heightCm: 176,
    weightKg: 82,
    activity: "LIGHT",
  };

  it("parses a valid entry and maps it to draft fields", () => {
    const c = parseCalculator(JSON.stringify(good));
    expect(c).toEqual(good);
    expect(draftFromCalculator(c!)).toEqual({
      goalType: "FAT_LOSS",
      sex: "MALE",
      heightCm: "176",
      weightKg: "82",
      activityLevel: "LIGHT",
    });
  });

  it("ignores missing or malformed entries", () => {
    expect(parseCalculator(null)).toBeNull();
    expect(parseCalculator("{not json")).toBeNull();
    expect(parseCalculator(JSON.stringify({ ...good, weightKg: "82" }))).toBeNull();
    expect(parseCalculator(JSON.stringify({ ...good, sex: "OTHER" }))).toBeNull();
  });
});
