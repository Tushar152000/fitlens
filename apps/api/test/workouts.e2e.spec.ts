import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestApp, onboard, type TestApp } from "./support/app.js";

describe("workouts", () => {
  let t: TestApp;
  beforeAll(async () => {
    t = await createTestApp();
  });
  afterAll(() => t.close());

  it("requires sign-in", async () => {
    await t.http().get("/api/workouts/today").expect(401);
    await t.http().post("/api/workouts/logs").send({}).expect(401);
    await t.http().post("/api/workouts/generate").expect(401);
  });

  it("builds this week's plan on first use and returns today's view", async () => {
    const { userId, agent } = await t.signIn();
    await onboard(agent);
    const res = await agent.get("/api/workouts/today?energy=tired").expect(200);
    expect(res.body).toMatchObject({
      planId: expect.any(String),
      phase: expect.any(String),
      split: expect.any(String),
      sessionMinutes: 45,
      fuel: { eatenKcal: 0, targetKcal: expect.any(Number) },
      completed: [],
    });
    expect(res.body.strip).toHaveLength(7);
    expect(res.body.strip.filter((d: { state: string }) => d.state !== "rest")).toHaveLength(3);
    expect(res.body.nextDay === null || typeof res.body.nextDay.date === "string").toBe(true);
    expect(await t.prisma.workoutPlan.count({ where: { userId } })).toBeGreaterThanOrEqual(1);

    // An unknown energy level falls back to "ok" instead of failing.
    const again = await agent.get("/api/workouts/today?energy=sleepy").expect(200);
    expect(again.body.planId).toBe(res.body.planId);
  });

  it("regenerates as a new version and logs sets against the owner's plan", async () => {
    const owner = await t.signIn();
    await onboard(owner.agent);
    const stranger = await t.signIn();

    const first = await owner.agent.post("/api/workouts/generate").expect(201);
    const second = await owner.agent.post("/api/workouts/generate").expect(201);
    expect(second.body).toMatchObject({ id: expect.any(String), version: first.body.version + 1 });
    expect(second.body.plan.days.length).toBe(3);

    const slug = second.body.plan.days[0].exercises[0].slug as string;
    const body = { planId: second.body.id, exerciseSlug: slug, sets: [{ kg: 20, reps: 10 }] };
    await owner.agent
      .post("/api/workouts/logs")
      .send({ ...body, sets: [] })
      .expect(400);
    await stranger.agent
      .post("/api/workouts/logs")
      .send(body)
      .expect(404, { error: "Plan not found" });
    await owner.agent
      .post("/api/workouts/logs")
      .send({ ...body, exerciseSlug: "not-an-exercise" })
      .expect(400, { error: "That exercise isn't in this plan" });

    const logged = await owner.agent.post("/api/workouts/logs").send(body).expect(201);
    expect(logged.body).toMatchObject({ exerciseSlug: slug, next: expect.any(Object) });
    // Logging the same exercise again the same day updates the row.
    await owner.agent.post("/api/workouts/logs").send(body).expect(201);
    expect(
      await t.prisma.workoutLog.count({ where: { userId: owner.userId, exerciseSlug: slug } }),
    ).toBe(1);
  });
});
