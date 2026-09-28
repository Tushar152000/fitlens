import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestApp, onboard, type TestApp } from "./support/app.js";

describe("water", () => {
  let t: TestApp;
  beforeAll(async () => {
    t = await createTestApp();
  });
  afterAll(() => t.close());

  it("requires sign-in", async () => {
    await t.http().get("/api/water").expect(401, { error: "Not signed in" });
  });

  it("asks for onboarding first", async () => {
    const { agent } = await t.signIn();
    const res = await agent.get("/api/water").expect(404);
    expect(res.body.error).toBe("Finish onboarding first");
  });

  it("logs, totals and undoes glasses", async () => {
    const { agent } = await t.signIn();
    // A real onboarding: the target depends on whether today is a training day in the week plan.
    await onboard(agent);

    const empty = await agent.get("/api/water").expect(200);
    expect(empty.body.consumedMl).toBe(0);
    expect(empty.body.targetMl).toBeGreaterThan(1500);

    const after = await agent.post("/api/water").send({ ml: 250 }).expect(201);
    expect(after.body.consumedMl).toBe(250);
    expect(after.body.logs).toHaveLength(1);

    await agent.post("/api/water").send({ ml: 99999 }).expect(400);

    await agent.delete(`/api/water/${after.body.logs[0].id}`).expect(204);
    await agent.delete(`/api/water/${after.body.logs[0].id}`).expect(404);
    expect((await agent.get("/api/water").expect(200)).body.consumedMl).toBe(0);
  });
});
