import { describe, expect, it } from "vitest";
import { labelAddsUp } from "./label.js";

describe("labelAddsUp", () => {
  it("passes a real biscuit label", () => {
    expect(labelAddsUp({ kcal: 537, protein: 4.3, carbs: 63.3, fat: 29.3 }).ok).toBe(true);
  });
  it("flags a misread (fat read as 2.9 instead of 29)", () => {
    expect(labelAddsUp({ kcal: 537, protein: 4.3, carbs: 63.3, fat: 2.9 }).ok).toBe(false);
  });
  it("uses an absolute margin for near-zero drinks", () => {
    expect(labelAddsUp({ kcal: 0.4, protein: 0, carbs: 0, fat: 0 }).ok).toBe(true);
  });
});
