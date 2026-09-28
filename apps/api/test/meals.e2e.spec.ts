import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { JobQueue } from "../src/infra/queue/job-queue.service.js";
import { StorageService } from "../src/infra/storage/storage.service.js";
import { createTestApp, onboard, type TestApp } from "./support/app.js";

type Agent = Awaited<ReturnType<TestApp["signIn"]>>["agent"];

const PNG = { data: Buffer.from([0x89, 0x50, 0x4e, 0x47]), mediaType: "image/png" };
const today = () => new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);

describe("meals", () => {
  let t: TestApp;
  beforeAll(async () => {
    t = await createTestApp();
  });
  afterEach(() => vi.restoreAllMocks());
  afterAll(() => t.close());

  /** A signed-in, onboarded user. */
  const user = async () => {
    const u = await t.signIn();
    await onboard(u.agent);
    return u;
  };
  const textMeal = (agent: Agent) =>
    agent
      .post("/api/meals")
      .send({ source: "TEXT", mealType: "LUNCH", text: "2 roti, 1 katori dal tadka" })
      .expect(201);

  it("requires sign-in on every route", async () => {
    const http = t.http;
    await http().get("/api/usage").expect(401);
    await http()
      .post("/api/meals/upload-url")
      .send({ contentType: "image/jpeg", sizeBytes: 1000 })
      .expect(401);
    await http().post("/api/meals").send({ source: "MANUAL", mealType: "LUNCH" }).expect(401);
    await http().get("/api/meals").expect(401);
    await http().get("/api/meals/usuals").expect(401);
    await http()
      .post("/api/meals/parse-items")
      .send({ text: "sugar", mealType: "SNACK" })
      .expect(401);
    await http().post("/api/meals/log-items").send({}).expect(401);
    await http().post("/api/meals/quick-add").send({}).expect(401);
    await http().post("/api/meals/relog").send({}).expect(401);
    await http().get("/api/meals/x").expect(401);
    await http().put("/api/meals/x").send({}).expect(401);
    await http().delete("/api/meals/x").expect(401);
    await http().post("/api/meals/x/recheck").send({}).expect(401);
  });

  it("signs a per-user upload URL", async () => {
    const { userId, agent } = await t.signIn();
    await agent
      .post("/api/meals/upload-url")
      .send({ contentType: "image/gif", sizeBytes: 10 })
      .expect(400);
    const res = await agent
      .post("/api/meals/upload-url")
      .send({ contentType: "image/jpeg", sizeBytes: 1000 })
      .expect(200);
    expect(res.body.key).toMatch(new RegExp(`^meals/${userId}/[0-9a-f-]+\\.jpg$`));
    expect(res.body.uploadUrl).toEqual(expect.stringContaining(res.body.key));
    expect(res.body.expiresIn).toBe(300);
  });

  it("reports photo scan usage", async () => {
    const { agent } = await t.signIn();
    const res = await agent.get("/api/usage").expect(200);
    expect(res.body).toEqual({ used: 0, limit: 3, left: 3, resetsAt: expect.any(String) });
  });

  it("validates the create body", async () => {
    const { agent } = await t.signIn();
    await agent
      .post("/api/meals")
      .send({ source: "TEXT", mealType: "LUNCH", text: "x" })
      .expect(400);
    await agent.post("/api/meals").send({ source: "FAX", mealType: "LUNCH" }).expect(400);
  });

  it("logs a typed meal inline, priced from the food database", async () => {
    const { userId, agent } = await user();
    const res = await textMeal(agent);
    expect(res.body).toMatchObject({ userId, status: "READY", source: "TEXT", mealType: "LUNCH" });
    const roti = res.body.items.find((i: { name: string }) => i.name === "roti");
    expect(roti).toMatchObject({ quantity: 2, unit: "piece", approximate: false });
    expect(res.body.totalKcal).toBeGreaterThan(0);
    const calls = await t.prisma.aiCall.findMany({ where: { userId } });
    expect(calls).toMatchObject([
      { type: "MEAL_TEXT", success: true, countsAsScan: false, provider: "mock" },
    ]);
  });

  it("creates an empty manual meal with no AI call", async () => {
    const { userId, agent } = await t.signIn();
    const res = await agent
      .post("/api/meals")
      .send({ source: "MANUAL", mealType: "DINNER" })
      .expect(201);
    expect(res.body).toMatchObject({ status: "READY", source: "TEXT", items: [] });
    expect(await t.prisma.aiCall.count({ where: { userId } })).toBe(0);
  });

  it("responds 202 PENDING when the analysis is queued", async () => {
    const { agent } = await user();
    vi.spyOn(t.app.get(JobQueue), "enqueue").mockResolvedValue("queued");
    const res = await agent
      .post("/api/meals")
      .send({ source: "TEXT", mealType: "SNACK", text: "1 banana" })
      .expect(202);
    expect(res.body).toEqual({ id: expect.any(String), status: "PENDING" });
  });

  describe("photos", () => {
    it("refuses someone else's photo key", async () => {
      const other = await t.signIn();
      const { agent } = await t.signIn();
      const res = await agent
        .post("/api/meals")
        .send({ source: "PHOTO", mealType: "LUNCH", photoKey: `meals/${other.userId}/a.jpg` })
        .expect(403);
      expect(res.body.error).toBe("Photo does not belong to you");
    });

    it("analyses a stored photo and counts a scan", async () => {
      const { userId, agent } = await user();
      const getImage = vi.spyOn(t.app.get(StorageService), "getImage").mockResolvedValue(PNG);
      const photoKey = `meals/${userId}/meal.png`;
      const res = await agent
        .post("/api/meals")
        .send({ source: "PHOTO", mealType: "LUNCH", photoKey })
        .expect(201);
      expect(getImage).toHaveBeenCalledWith(photoKey);
      expect(res.body).toMatchObject({
        status: "READY",
        photoKey,
        aiNotes: expect.stringContaining("Oil or ghee"),
      });
      expect(res.body.items).toHaveLength(4);
      expect((await agent.get("/api/usage").expect(200)).body).toMatchObject({ used: 1, left: 2 });

      const one = await agent.get(`/api/meals/${res.body.id}`).expect(200);
      expect(one.body.photoUrl).toEqual(expect.stringContaining(photoKey));
    });

    it("records a failed analysis when storage is down, without using a scan", async () => {
      const { userId, agent } = await user();
      const res = await agent
        .post("/api/meals")
        .send({ source: "PHOTO", mealType: "LUNCH", photoKey: `meals/${userId}/gone.jpg` })
        .expect(201);
      expect(res.body).toMatchObject({
        status: "FAILED",
        error: "Analysis failed. You can retry or log by text.",
      });
      const call = await t.prisma.aiCall.findFirstOrThrow({ where: { userId } });
      expect(call).toMatchObject({
        type: "MEAL_PHOTO",
        success: false,
        model: "unknown",
        countsAsScan: false,
      });
    });

    it("stops at the daily photo limit with the usage in details", async () => {
      const { userId, agent } = await user();
      await t.prisma.aiCall.createMany({
        data: Array.from({ length: 3 }, () => ({
          userId,
          type: "MEAL_PHOTO" as const,
          provider: "mock",
          model: "mock",
          latencyMs: 1,
          success: true,
          countsAsScan: true,
        })),
      });
      const res = await agent
        .post("/api/meals")
        .send({ source: "PHOTO", mealType: "LUNCH", photoKey: `meals/${userId}/x.jpg` })
        .expect(429);
      expect(res.body).toMatchObject({
        error: "You've used today's 3 free photo scans.",
        details: { used: 3, limit: 3, left: 0 },
      });
    });
  });

  it("lists, reads, confirms and deletes only the owner's meals", async () => {
    const owner = await user();
    const stranger = await t.signIn();
    const meal = (await textMeal(owner.agent)).body;

    const list = await owner.agent.get("/api/meals").expect(200);
    expect(list.body.meals.map((m: { id: string }) => m.id)).toContain(meal.id);
    expect((await stranger.agent.get("/api/meals").expect(200)).body.meals).toEqual([]);
    const dated = await owner.agent.get("/api/meals?date=2001-01-01").expect(200);
    expect(dated.body.meals).toEqual([]);

    const got = await owner.agent.get(`/api/meals/${meal.id}`).expect(200);
    expect(got.body).toMatchObject({ id: meal.id, photoUrl: null, items: expect.any(Array) });
    expect((await stranger.agent.get(`/api/meals/${meal.id}`).expect(404)).body.error).toBe(
      "Meal not found",
    );

    const items = [{ name: "roti", quantity: 3, unit: "piece", grams: 120 }];
    await owner.agent.put(`/api/meals/${meal.id}`).send({ items: [] }).expect(400);
    await stranger.agent.put(`/api/meals/${meal.id}`).send({ items }).expect(404);
    const confirmed = await owner.agent
      .put(`/api/meals/${meal.id}`)
      .send({ items, note: "extra ghee" })
      .expect(200);
    expect(confirmed.body).toMatchObject({
      status: "CONFIRMED",
      note: "extra ghee",
      items: [{ name: "roti", edited: true }],
    });
    expect(confirmed.body.totalKcal).toBeCloseTo(confirmed.body.items[0].kcal, 1);

    await stranger.agent.delete(`/api/meals/${meal.id}`).expect(404);
    await owner.agent.delete(`/api/meals/${meal.id}`).expect(204);
    await owner.agent.get(`/api/meals/${meal.id}`).expect(404);
  });

  it("won't confirm or recheck a meal that is still analysing", async () => {
    const { userId, agent } = await t.signIn();
    const pending = await t.prisma.mealLog.create({
      data: { userId, date: today(), mealType: "LUNCH", source: "TEXT", inputText: "poha" },
    });
    const items = [{ name: "poha", quantity: 1, unit: "plate", grams: 150 }];
    const res = await agent.put(`/api/meals/${pending.id}`).send({ items }).expect(409);
    expect(res.body.error).toBe("Still analysing — try again in a moment");
    await agent.post(`/api/meals/${pending.id}/recheck`).send({}).expect(409);
  });

  it("rechecks a meal with the user's note", async () => {
    const owner = await user();
    const stranger = await t.signIn();
    const meal = (await textMeal(owner.agent)).body;
    await owner.agent.post(`/api/meals/${meal.id}/recheck`).send({ note: "x" }).expect(400);
    await stranger.agent.post(`/api/meals/${meal.id}/recheck`).send({}).expect(404);

    const res = await owner.agent
      .post(`/api/meals/${meal.id}/recheck`)
      .send({ note: "2 roti only" })
      .expect(200);
    expect(res.body).toEqual({ id: meal.id, status: "DONE" });
    const after = await owner.agent.get(`/api/meals/${meal.id}`).expect(200);
    expect(after.body).toMatchObject({ status: "READY", note: "2 roti only" });

    vi.spyOn(t.app.get(JobQueue), "enqueue").mockResolvedValue("queued");
    await owner.agent
      .post(`/api/meals/${meal.id}/recheck`)
      .send({})
      .expect(202, { id: meal.id, status: "PENDING" });
  });

  it("parses extra items without saving a meal", async () => {
    const { userId, agent } = await user();
    await agent.post("/api/meals/parse-items").send({ text: "s", mealType: "SNACK" }).expect(400);
    const res = await agent
      .post("/api/meals/parse-items")
      .send({ text: "1 banana", mealType: "SNACK" })
      .expect(200);
    expect(res.body.items).toMatchObject([
      { name: "banana", approximate: false, aiConfidence: 0.6 },
    ]);
    expect(await t.prisma.mealLog.count({ where: { userId } })).toBe(0);
  });

  it("logs known foods and quick-adds, with food visibility checks", async () => {
    const owner = await user();
    const stranger = await t.signIn();
    const banana = await t.prisma.food.findUniqueOrThrow({ where: { name: "banana" } });
    const privateFood = await t.prisma.food.create({
      data: {
        name: `private biscuit ${Date.now()}`,
        source: "LABEL_SCAN",
        verified: false,
        submittedById: stranger.userId,
        kcalPer100g: 480,
        proteinPer100g: 7,
        carbsPer100g: 70,
        fatPer100g: 19,
      },
    });

    await owner.agent
      .post("/api/meals/log-items")
      .send({ mealType: "SNACK", items: [] })
      .expect(400);
    await owner.agent
      .post("/api/meals/log-items")
      .send({
        mealType: "SNACK",
        items: [{ foodId: "nope", quantity: 1, unit: "piece", grams: 118 }],
      })
      .expect(404, { error: "Food not found" });
    const logged = await owner.agent
      .post("/api/meals/log-items")
      .send({
        mealType: "SNACK",
        items: [{ foodId: banana.id, quantity: 1, unit: "piece", grams: 118 }],
      })
      .expect(201);
    expect(logged.body).toEqual({ id: expect.any(String) });
    const snack = await t.prisma.mealLog.findUniqueOrThrow({
      where: { id: logged.body.id },
      include: { items: true },
    });
    expect(snack).toMatchObject({ userId: owner.userId, status: "CONFIRMED", totalKcal: 105 });

    const quick = { mealType: "SNACK", quantity: 1, unit: "piece", grams: 25 };
    await owner.agent
      .post("/api/meals/quick-add")
      .send({ ...quick, grams: -1, foodId: banana.id })
      .expect(400);
    await owner.agent
      .post("/api/meals/quick-add")
      .send({ ...quick, foodId: privateFood.id })
      .expect(404);
    await stranger.agent
      .post("/api/meals/quick-add")
      .send({ ...quick, foodId: privateFood.id })
      .expect(201);
    const added = await owner.agent
      .post("/api/meals/quick-add")
      .send({ ...quick, foodId: banana.id })
      .expect(201);
    expect(added.body).toEqual({ id: expect.any(String) });
  });

  it("shows usuals and relogs them into today", async () => {
    const owner = await user();
    const stranger = await t.signIn();
    const items = [{ name: "idli", quantity: 2, unit: "piece", grams: 80 }];
    for (let i = 0; i < 2; i++) {
      const meal = (
        await owner.agent
          .post("/api/meals")
          .send({ source: "MANUAL", mealType: "BREAKFAST" })
          .expect(201)
      ).body;
      await owner.agent.put(`/api/meals/${meal.id}`).send({ items }).expect(200);
    }
    const usuals = await owner.agent.get("/api/meals/usuals").expect(200);
    expect(usuals.body.usuals).toMatchObject([
      { count: 2, names: ["idli"], mealType: "BREAKFAST" },
    ]);
    expect((await stranger.agent.get("/api/meals/usuals").expect(200)).body.usuals).toEqual([]);

    const mealId = usuals.body.usuals[0].mealId;
    await owner.agent.post("/api/meals/relog").send({ mealId }).expect(400);
    await stranger.agent
      .post("/api/meals/relog")
      .send({ mealId, mealType: "SNACK" })
      .expect(404, { error: "Meal not found" });
    const relog = await owner.agent
      .post("/api/meals/relog")
      .send({ mealId, mealType: "SNACK" })
      .expect(201);
    const copy = await t.prisma.mealLog.findUniqueOrThrow({
      where: { id: relog.body.id },
      include: { items: true },
    });
    expect(copy).toMatchObject({
      status: "CONFIRMED",
      mealType: "SNACK",
      items: [{ name: "idli", quantity: 2 }],
    });
  });
});
