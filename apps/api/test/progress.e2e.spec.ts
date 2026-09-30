import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestApp, onboard, type TestApp } from "./support/app.js";

const DAY = 86_400_000;
/** Local "today" for Asia/Kolkata (the onboarding payload's timezone), as a UTC-midnight Date. */
const localToday = () =>
  new Date(
    `${new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date())}T00:00:00.000Z`,
  );
const ymd = (d: Date) => d.toISOString().slice(0, 10);

describe("progress", () => {
  let t: TestApp;
  beforeAll(async () => {
    t = await createTestApp();
  });
  afterAll(() => t.close());

  const confirmedMeal = (userId: string, date: Date, kcal: number, photoKey?: string) =>
    t.prisma.mealLog.create({
      data: {
        userId,
        date,
        mealType: "LUNCH",
        source: photoKey ? "PHOTO" : "TEXT",
        photoKey,
        status: "CONFIRMED",
        confirmedAt: new Date(),
        totalKcal: kcal,
        totalProtein: 20,
        aiRaw: { secret: true },
        items: {
          create: [
            {
              name: "dal tadka",
              quantity: 1,
              unit: "katori",
              grams: 150,
              kcal,
              proteinG: 20,
              carbsG: 0,
              fatG: 0,
            },
          ],
        },
      },
    });

  it("requires sign-in", async () => {
    await t.http().get("/api/checkins").expect(401);
    await t.http().post("/api/checkins").send({ weightKg: 80 }).expect(401);
    await t.http().get("/api/dashboard").expect(401);
    await t.http().get("/api/history").expect(401);
    await t.http().get("/api/progress").expect(401);
  });

  it("logs weigh-ins (one per day) and lists only the caller's", async () => {
    const { userId, agent } = await t.signIn();
    await onboard(agent);
    const stranger = await t.signIn();

    await agent.post("/api/checkins").send({ weightKg: 10 }).expect(400);
    const res = await agent
      .post("/api/checkins")
      .send({ date: "2026-01-05", weightKg: 81, waistCm: 90, neckCm: 38 })
      .expect(201);
    expect(res.body.metric).toMatchObject({
      userId,
      date: "2026-01-05T00:00:00.000Z",
      weightKg: 81,
      bodyFatPct: expect.any(Number),
    });
    await agent.post("/api/checkins").send({ date: "2026-01-05", weightKg: 80.5 }).expect(201);

    const list = await agent.get("/api/checkins").expect(200);
    expect(list.body.metrics.map((m: { weightKg: number }) => m.weightKg)).toEqual([80.5, 82]);
    expect((await stranger.agent.get("/api/checkins").expect(200)).body.metrics).toEqual([]);
  });

  it("builds the Today dashboard with a streak, photo links and no raw AI output", async () => {
    const { userId, agent } = await t.signIn();
    const plan = await onboard(agent);
    const stranger = await t.signIn();
    const today = localToday();
    await confirmedMeal(userId, today, 500, `meals/${userId}/p.jpg`);
    await confirmedMeal(userId, new Date(today.getTime() - DAY), 400);
    await confirmedMeal(stranger.userId, today, 999);

    const res = await agent.get("/api/dashboard").expect(200);
    expect(res.body).toMatchObject({
      date: ymd(today),
      target: { kcal: plan.target.kcal, reason: "Initial targets from onboarding" },
      eaten: { kcal: 500, proteinG: 20 },
      remainingKcal: plan.target.kcal - 500,
      streak: 2,
      timezone: "Asia/Kolkata",
    });
    expect(res.body.meals).toHaveLength(1);
    expect(res.body.meals[0].aiRaw).toBeUndefined();
    expect(res.body.meals[0].photoUrl).toEqual(expect.stringContaining(`meals/${userId}/p.jpg`));

    const yesterday = await agent
      .get(`/api/dashboard?date=${ymd(new Date(today.getTime() - DAY))}`)
      .expect(200);
    expect(yesterday.body).toMatchObject({ eaten: { kcal: 400 }, streak: 2 });
  });

  it("returns 7 or 30 days of history", async () => {
    const { userId, agent } = await t.signIn();
    await onboard(agent);
    const today = localToday();
    await confirmedMeal(userId, new Date(today.getTime() - 2 * DAY), 1800);

    const week = await agent.get("/api/history").expect(200);
    expect(week.body.days).toHaveLength(7);
    expect(week.body).toMatchObject({ daysLogged: 1, avgKcalFullDays: 1800 });
    const day = week.body.days[4];
    expect(day).toMatchObject({
      kcal: 1800,
      logged: true,
      isToday: false,
      meals: [{ title: "Dal tadka", kcal: 1800 }],
    });
    expect(week.body.days[6]).toMatchObject({
      date: ymd(today),
      isToday: true,
      target: expect.any(Number),
    });

    expect((await agent.get("/api/history?days=30").expect(200)).body.days).toHaveLength(30);
  });

  it("shows the weigh-in trend against the plan", async () => {
    const { userId, agent } = await t.signIn();
    await onboard(agent);
    await confirmedMeal(userId, localToday(), 1700);
    const res = await agent.get("/api/progress").expect(200);
    expect(res.body).toMatchObject({
      points: [{ weightKg: 82, avg7: 82 }],
      latest: { weightKg: 82 },
      plan: { startWeightKg: 82, targetWeightKg: 76, goalType: "FAT_LOSS" },
      weeklyChange: null,
      target: { kcal: expect.any(Number), effectiveFrom: ymd(localToday()) },
      avgIntake: 1700,
      daysLogged: 1,
    });
  });
});
