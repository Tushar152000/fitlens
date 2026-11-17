import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestApp, onboard, onboardingPayload, type TestApp } from "./support/app.js";

const DAY = 86_400_000;
const daysAgo = (n: number) => new Date(Date.now() - n * DAY);

/** The changeable numbers, as the welcome-back screen sends them. */
const refresh = (overrides: Record<string, unknown> = {}) => ({
  weightKg: 78,
  heightCm: 176,
  activityLevel: "MODERATE",
  equipment: "DUMBBELLS",
  trainingDaysPerWeek: 4,
  sessionMinutes: 60,
  injuries: ["knee"],
  medicalFlag: false,
  timezone: "Asia/Kolkata",
  ...overrides,
});

describe("welcome back", () => {
  let t: TestApp;
  beforeAll(async () => {
    t = await createTestApp();
  });
  afterAll(() => t.close());

  /** An onboarded user whose last visit was `days` ago. */
  async function awayFor(days: number, goal?: Record<string, unknown>) {
    const user = await t.signIn();
    await onboard(user.agent, goal ? { goal } : {});
    await t.prisma.user.update({
      where: { id: user.userId },
      data: { lastActiveAt: daysAgo(days) },
    });
    return user;
  }

  it("requires sign-in", async () => {
    await t.http().post("/api/welcome-back").send(refresh()).expect(401);
    await t.http().post("/api/me/active").expect(401);
  });

  it("is never set before onboarding, and onboarding records activity", async () => {
    const { userId, agent } = await t.signIn();
    expect((await agent.get("/api/me").expect(200)).body).toMatchObject({
      onboarded: false,
      welcomeBack: false,
    });
    await onboard(agent);
    expect((await agent.get("/api/me").expect(200)).body.welcomeBack).toBe(false);
    const user = await t.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(user.lastActiveAt).not.toBeNull();
  });

  it("stays off for a user who was here recently", async () => {
    const { agent } = await awayFor(89);
    expect((await agent.get("/api/me").expect(200)).body.welcomeBack).toBe(false);
  });

  it("asks after 90+ days away and keeps asking until answered", async () => {
    const { userId, agent } = await awayFor(120);
    const before = await t.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect((await agent.get("/api/me").expect(200)).body).toMatchObject({
      onboarded: true,
      welcomeBack: true,
    });
    // A restart (another /me) doesn't clear it: activity isn't recorded while it's pending.
    expect((await agent.get("/api/me").expect(200)).body.welcomeBack).toBe(true);
    const after = await t.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(after.lastActiveAt).toEqual(before.lastActiveAt);
  });

  it("signing out and back in: onboarding isn't asked again, welcome back still is", async () => {
    const { userId, agent } = await awayFor(200);
    const { email } = await t.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    await agent.post("/api/auth/signout").expect(204);
    await agent.get("/api/me").expect(401);

    const again = t.browser();
    const res = await again.post("/api/auth/dev").send({ email, name: "Test User" }).expect(200);
    expect(res.body.userId).toBe(userId);
    expect((await again.get("/api/me").expect(200)).body).toMatchObject({
      onboarded: true,
      welcomeBack: true,
    });
  });

  it("rejects invalid input", async () => {
    const { agent } = await awayFor(120);
    expect((await agent.post("/api/welcome-back").send({}).expect(400)).body.error).toBe(
      "Invalid input",
    );
    await agent
      .post("/api/welcome-back")
      .send(refresh({ weightKg: 10 }))
      .expect(400);
    await agent
      .post("/api/welcome-back")
      .send(refresh({ trainingDaysPerWeek: 9 }))
      .expect(400);
    await agent
      .post("/api/welcome-back")
      .send(refresh({ equipment: "SPACESHIP" }))
      .expect(400);
  });

  it("404s before onboarding", async () => {
    const { agent } = await t.signIn();
    expect((await agent.post("/api/welcome-back").send(refresh()).expect(404)).body.error).toBe(
      "Finish onboarding first",
    );
  });

  it("updates only the changeable numbers, keeps the goal and recomputes targets", async () => {
    const { userId, agent } = await awayFor(120);
    const goalBefore = await t.prisma.goal.findFirstOrThrow({
      where: { userId, status: "ACTIVE" },
    });
    const targetBefore = (await agent.get("/api/targets").expect(200)).body.target;

    const res = await agent.post("/api/welcome-back").send(refresh()).expect(200);
    expect(res.body).toMatchObject({
      goalPassed: false,
      summary: {
        target: { userId, reason: "Updated after a break: new weight and routine" },
        plan: { feasible: expect.any(Boolean) },
      },
    });
    expect(res.body.summary.target.id).not.toBe(targetBefore.id);

    const profile = await t.prisma.profile.findUniqueOrThrow({ where: { userId } });
    expect(profile).toMatchObject({
      heightCm: 176,
      activityLevel: "MODERATE",
      trainingDaysPerWeek: 4,
      sessionMinutes: 60,
      injuries: ["knee"],
      equipment: "DUMBBELLS",
      // Untouched: not asked again.
      sex: "MALE",
      dietType: "VEG",
      experience: "BEGINNER",
    });
    const goals = await t.prisma.goal.findMany({ where: { userId, status: "ACTIVE" } });
    expect(goals).toHaveLength(1);
    expect(goals[0].id).toBe(goalBefore.id);
    const plan = await agent.get("/api/plan").expect(200);
    expect(plan.body.metric.weightKg).toBe(78);
    expect((await agent.get("/api/targets").expect(200)).body.target.id).toBe(
      res.body.summary.target.id,
    );

    expect((await agent.get("/api/me").expect(200)).body.welcomeBack).toBe(false);
  });

  it("says when the goal date went by during the break", async () => {
    const past = new Date(Date.now() - 30 * DAY).toISOString().slice(0, 10);
    const { userId, agent } = await awayFor(120);
    await t.prisma.goal.updateMany({
      where: { userId, status: "ACTIVE" },
      data: { targetDate: new Date(`${past}T00:00:00Z`) },
    });
    const res = await agent.post("/api/welcome-back").send(refresh()).expect(200);
    expect(res.body.goalPassed).toBe(true);
  });

  it("needs waist and neck for a body-fat goal", async () => {
    const { agent } = await t.signIn();
    await agent
      .post("/api/onboarding")
      .send(
        onboardingPayload({
          waistCm: 90,
          neckCm: 38,
          goal: {
            type: "FAT_LOSS",
            targetBodyFatPct: 18,
            targetDate: new Date(Date.now() + 200 * DAY).toISOString().slice(0, 10),
          },
        }),
      )
      .expect(201);
    await agent.post("/api/welcome-back").send(refresh()).expect(400);
    const res = await agent
      .post("/api/welcome-back")
      .send(refresh({ waistCm: 86, neckCm: 38 }))
      .expect(200);
    expect(res.body.summary.bodyFatPct).toEqual(expect.any(Number));
  });

  it("'Not now' stops asking without changing anything", async () => {
    const { userId, agent } = await awayFor(150);
    const before = await t.prisma.profile.findUniqueOrThrow({ where: { userId } });
    await agent.post("/api/me/active").expect(204);
    expect((await agent.get("/api/me").expect(200)).body.welcomeBack).toBe(false);
    const after = await t.prisma.profile.findUniqueOrThrow({ where: { userId } });
    expect(after.updatedAt).toEqual(before.updatedAt);
  });
});
