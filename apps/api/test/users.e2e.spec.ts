import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestApp, onboard, type TestApp } from "./support/app.js";

describe("users", () => {
  let t: TestApp;
  beforeAll(async () => {
    t = await createTestApp();
  });
  afterAll(() => t.close());

  it("requires sign-in", async () => {
    await t.http().get("/api/export").expect(401);
    await t.http().patch("/api/profile/reminders").send({ water: true }).expect(401);
  });

  it("saves reminder switches after onboarding", async () => {
    const { agent } = await t.signIn();
    await agent
      .patch("/api/profile/reminders")
      .send({ water: true })
      .expect(404, { error: "Finish onboarding first" });
    await onboard(agent);
    await agent.patch("/api/profile/reminders").send({ lunch: "yes" }).expect(400);
    const res = await agent
      .patch("/api/profile/reminders")
      .send({ water: true, dinner: false })
      .expect(200);
    expect(res.body).toEqual({
      remindLunch: expect.any(Boolean),
      remindDinner: false,
      remindWater: true,
    });
  });

  it("exports the caller's confirmed meals and weigh-ins as CSV", async () => {
    const { userId, agent } = await t.signIn();
    await onboard(agent);
    const stranger = await t.signIn();
    const meal = {
      date: new Date("2026-02-01T00:00:00.000Z"),
      mealType: "DINNER" as const,
      source: "TEXT" as const,
      status: "CONFIRMED" as const,
      note: 'with "extra" ghee, lots',
      items: {
        create: [
          {
            name: "dal tadka",
            quantity: 1,
            unit: "katori",
            grams: 150.4,
            kcal: 180.6,
            proteinG: 9.04,
            carbsG: 22.5,
            fatG: 6,
          },
        ],
      },
    };
    await t.prisma.mealLog.create({ data: { userId, ...meal } });
    await t.prisma.mealLog.create({
      data: { userId: stranger.userId, ...meal, note: "not yours" },
    });
    await t.prisma.mealLog.create({
      data: { userId, ...meal, status: "READY", note: "unconfirmed" },
    });

    const res = await agent.get("/api/export").expect(200);
    expect(res.headers["content-type"]).toBe("text/csv; charset=utf-8");
    expect(res.headers["content-disposition"]).toMatch(
      /^attachment; filename="fitlens-export-\d{4}-\d{2}-\d{2}\.csv"$/,
    );
    expect(res.headers["cache-control"]).toBe("no-store");
    const lines = res.text.trimEnd().split("\n");
    expect(lines[0]).toBe(
      "type,date,meal,item,quantity,unit,grams,kcal,protein_g,carbs_g,fat_g,note",
    );
    expect(lines[1]).toBe(
      'meal_item,2026-02-01,dinner,dal tadka,1,katori,150,181,9,22.5,6,"with ""extra"" ghee, lots"',
    );
    expect(lines[2]).toMatch(/^weigh_in,\d{4}-\d{2}-\d{2},,weight_kg,82,kg,,,,,,$/);
    expect(lines).toHaveLength(3);
  });
});
