import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestApp, onboard, onboardingPayload, type TestApp } from "./support/app.js";

const inMonths = (n: number) => {
  const d = new Date();
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 10);
};

describe("plan", () => {
  let t: TestApp;
  beforeAll(async () => {
    t = await createTestApp();
  });
  afterAll(() => t.close());

  it("requires sign-in", async () => {
    await t.http().post("/api/onboarding").send(onboardingPayload()).expect(401);
    await t.http().get("/api/targets").expect(401);
    await t.http().get("/api/plan").expect(401);
    await t.http().post("/api/goal/option").send({ choice: "KEEP_GOAL" }).expect(401);
  });

  it("asks for onboarding before targets and plan exist", async () => {
    const { agent } = await t.signIn();
    expect((await agent.get("/api/targets").expect(404)).body.error).toBe(
      "Finish onboarding first",
    );
    expect((await agent.get("/api/plan").expect(404)).body.error).toBe("Finish onboarding first");
  });

  it("rejects an invalid onboarding payload", async () => {
    const { agent } = await t.signIn();
    const res = await agent.post("/api/onboarding").send({ sex: "MALE" }).expect(400);
    expect(res.body.error).toBe("Invalid input");
    await agent
      .post("/api/onboarding")
      .send(onboardingPayload({ goal: { type: "FAT_LOSS", targetDate: inMonths(6) } }))
      .expect(400);
  });

  it("onboards, stores targets and rebuilds the plan", async () => {
    const { userId, agent } = await t.signIn();
    const res = await agent
      .post("/api/onboarding")
      .send(onboardingPayload({ waistCm: 90, neckCm: 38 }))
      .expect(201);
    expect(res.body).toMatchObject({
      bmi: { value: expect.any(Number), category: expect.any(String) },
      bodyFatPct: expect.any(Number),
      target: {
        userId,
        kcal: expect.any(Number),
        proteinG: expect.any(Number),
        reason: "Initial targets from onboarding",
      },
      plan: {
        bmr: expect.any(Number),
        tdee: expect.any(Number),
        feasible: true,
        warnings: expect.any(Array),
      },
    });

    const targets = await agent.get("/api/targets").expect(200);
    expect(targets.body.target.id).toBe(res.body.target.id);

    const plan = await agent.get("/api/plan").expect(200);
    expect(plan.body).toMatchObject({
      summary: { target: { kcal: res.body.target.kcal } },
      goal: { type: "FAT_LOSS", targetWeightKg: 76 },
      metric: { weightKg: 82, waistCm: 90, neckCm: 38 },
      training: { daysPerWeek: 3, sessionMinutes: 45 },
    });

    // Re-running onboarding abandons the old goal.
    await onboard(agent, { weightKg: 80 });
    expect(await t.prisma.goal.count({ where: { userId, status: "ACTIVE" } })).toBe(1);
  });

  it("goal options: validates, no-ops on a feasible goal, and fixes a too-fast one", async () => {
    const { agent } = await t.signIn();
    await onboard(agent);
    await agent.post("/api/goal/option").send({ choice: "NOPE" }).expect(400);
    expect(
      (await agent.post("/api/goal/option").send({ choice: "KEEP_GOAL" }).expect(200)).body,
    ).toEqual({
      ok: true,
      changed: false,
    });

    const tooFast = { goal: { type: "FAT_LOSS", targetWeightKg: 65, targetDate: inMonths(1) } };
    const a = await t.signIn();
    const summary = await onboard(a.agent, tooFast);
    expect(summary.plan.feasible).toBe(false);
    const moved = await a.agent.post("/api/goal/option").send({ choice: "KEEP_GOAL" }).expect(200);
    expect(moved.body).toMatchObject({
      ok: true,
      changed: true,
      target: { reason: expect.stringMatching(/^Goal date moved to/) },
    });

    const b = await t.signIn();
    await onboard(b.agent, tooFast);
    const closer = await b.agent.post("/api/goal/option").send({ choice: "KEEP_DATE" }).expect(200);
    expect(closer.body.target.reason).toMatch(/^Target set to [\d.]+ kg by/);
    const plan = await b.agent.get("/api/plan").expect(200);
    expect(plan.body.goal.targetWeightKg).toBeGreaterThan(65);
  });
});
