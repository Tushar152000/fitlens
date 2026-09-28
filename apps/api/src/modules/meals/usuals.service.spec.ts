import { describe, expect, it } from "vitest";
import { usualSignature } from "./usuals.service.js";

describe("usualSignature", () => {
  it("ignores item order", () => {
    const a = usualSignature([
      { name: "roti", quantity: 2, unit: "piece" },
      { name: "dal tadka", quantity: 1, unit: "katori" },
    ]);
    const b = usualSignature([
      { name: "dal tadka", quantity: 1, unit: "katori" },
      { name: "roti", quantity: 2, unit: "piece" },
    ]);
    expect(a).toBe(b);
  });

  it("treats different amounts as different usuals", () => {
    expect(usualSignature([{ name: "roti", quantity: 2, unit: "piece" }])).not.toBe(
      usualSignature([{ name: "roti", quantity: 3, unit: "piece" }]),
    );
  });
});
