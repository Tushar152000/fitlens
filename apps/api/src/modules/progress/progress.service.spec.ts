import { describe, expect, it } from "vitest";
import { sevenDayAverages } from "./progress.service.js";

const d = (s: string) => new Date(`${s}T00:00:00Z`);

describe("sevenDayAverages", () => {
  it("averages weigh-ins in the trailing 7 days", () => {
    const points = sevenDayAverages([
      { date: d("2026-09-01"), weightKg: 80 },
      { date: d("2026-09-04"), weightKg: 79 },
      { date: d("2026-09-07"), weightKg: 78 },
      { date: d("2026-09-08"), weightKg: 78.5 }, // 09-01 drops out of the window
    ]);
    expect(points.map((p) => p.avg7)).toEqual([80, 79.5, 79, 78.5]);
  });
});
