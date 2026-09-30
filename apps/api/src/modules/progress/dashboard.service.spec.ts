import { describe, expect, it } from "vitest";
import type { PrismaService } from "../../infra/prisma/prisma.service.js";
import type { StorageService } from "../../infra/storage/storage.service.js";
import type { TargetsService } from "../plan/targets.service.js";
import type { UsersService } from "../users/users.service.js";
import { DashboardService } from "./dashboard.service.js";

const d = (s: string) => new Date(`${s}T00:00:00Z`);

function withLoggedDays(days: string[]) {
  const prisma = {
    mealLog: { findMany: async () => days.map((s) => ({ date: d(s) })) },
  } as unknown as PrismaService;
  return new DashboardService(
    prisma,
    {} as TargetsService,
    {} as StorageService,
    {} as UsersService,
  );
}

describe("DashboardService.loggingStreak", () => {
  it("counts consecutive days ending today", async () => {
    const s = withLoggedDays(["2026-09-10", "2026-09-09", "2026-09-08", "2026-09-06"]);
    expect(await s.loggingStreak("u", d("2026-09-10"))).toBe(3);
  });

  it("still counts from yesterday before today's first meal", async () => {
    const s = withLoggedDays(["2026-09-09", "2026-09-08"]);
    expect(await s.loggingStreak("u", d("2026-09-10"))).toBe(2);
  });

  it("is 0 after a missed day", async () => {
    expect(await withLoggedDays(["2026-09-08"]).loggingStreak("u", d("2026-09-10"))).toBe(0);
    expect(await withLoggedDays([]).loggingStreak("u", d("2026-09-10"))).toBe(0);
  });
});
