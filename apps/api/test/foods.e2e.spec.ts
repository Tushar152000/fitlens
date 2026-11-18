import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { StorageService } from "../src/infra/storage/storage.service.js";
import { FOOD_EXTRACTOR, type FoodExtractor } from "../src/modules/ai/index.js";
import { createTestApp, onboard, randomEan13, type TestApp } from "./support/app.js";

const PNG = { data: Buffer.from([0x89, 0x50, 0x4e, 0x47]), mediaType: "image/png" };
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("foods", () => {
  let t: TestApp;
  beforeAll(async () => {
    t = await createTestApp();
  });
  afterEach(() => vi.restoreAllMocks());
  afterAll(() => t.close());

  const labelFood = (
    submittedById: string,
    extra: { barcode?: string; kcalPer100g?: number } = {},
  ) =>
    t.prisma.food.create({
      data: {
        name: `label food ${Math.random().toString(36).slice(2)}`,
        source: "LABEL_SCAN",
        verified: false,
        submittedById,
        kcalPer100g: 480,
        proteinPer100g: 7,
        carbsPer100g: 70,
        fatPer100g: 19,
        ...extra,
      },
    });

  it("requires sign-in on every route", async () => {
    await t.http().get("/api/foods?q=roti").expect(401);
    await t.http().get(`/api/foods/barcode/${randomEan13()}`).expect(401);
    await t.http().post("/api/foods/label").send({ photoKey: "k" }).expect(401);
    await t.http().get("/api/foods/label/x").expect(401);
    await t.http().post("/api/foods/label/x/save").send({}).expect(401);
  });

  describe("search", () => {
    it("finds foods with nutrition and units; unreviewed scans only for their submitter", async () => {
      const owner = await t.signIn();
      const stranger = await t.signIn();
      const mine = await labelFood(owner.userId);

      const res = await owner.agent.get("/api/foods?q=Roti").expect(200);
      expect(res.body.foods).toContainEqual({
        id: expect.any(String),
        name: "roti",
        per100g: {
          kcal: expect.any(Number),
          protein: expect.any(Number),
          carbs: expect.any(Number),
          fat: expect.any(Number),
        },
        units: expect.arrayContaining([{ unit: "piece", grams: expect.any(Number) }]),
        isLiquid: false,
      });

      const own = await owner.agent
        .get(`/api/foods?q=${encodeURIComponent(mine.name)}`)
        .expect(200);
      expect(own.body.foods.map((f: { id: string }) => f.id)).toEqual([mine.id]);
      const other = await stranger.agent
        .get(`/api/foods?q=${encodeURIComponent(mine.name)}`)
        .expect(200);
      expect(other.body.foods).toEqual([]);

      expect((await owner.agent.get("/api/foods").expect(200)).body.foods).toHaveLength(12);
    });
  });

  describe("barcode", () => {
    it("rejects a malformed code", async () => {
      const { agent } = await t.signIn();
      await agent
        .get("/api/foods/barcode/12345")
        .expect(400, { error: "That isn't a valid barcode" });
    });

    it("returns a known product without calling Open Food Facts", async () => {
      const { agent } = await t.signIn();
      const code = randomEan13();
      const food = await t.prisma.food.create({
        data: {
          name: `known ${code}`,
          source: "OPEN_FOOD_FACTS",
          verified: true,
          barcode: code,
          kcalPer100g: 500,
          proteinPer100g: 6,
          carbsPer100g: 60,
          fatPer100g: 25,
        },
      });
      const fetch = vi.spyOn(globalThis, "fetch");
      const res = await agent.get(`/api/foods/barcode/${code}`).expect(200);
      expect(res.body).toMatchObject({ code, food: { id: food.id, name: food.name } });
      expect(fetch).not.toHaveBeenCalled();
    });

    it("hides someone else's label scan whose numbers don't add up", async () => {
      const stranger = await t.signIn();
      const { agent } = await t.signIn();
      const code = randomEan13();
      await labelFood(stranger.userId, { barcode: code, kcalPer100g: 900 });
      const res = await agent.get(`/api/foods/barcode/${code}`).expect(404);
      expect(res.body).toEqual({ error: "We don't know this product yet", details: { code } });
      await stranger.agent.get(`/api/foods/barcode/${code}`).expect(200);
    });

    it("shares someone else's older label scan once its numbers add up", async () => {
      const stranger = await t.signIn();
      const { agent } = await t.signIn();
      const code = randomEan13();
      const food = await labelFood(stranger.userId, { barcode: code }); // 480 kcal ≈ 4·7 + 4·70 + 9·19
      const fetch = vi.spyOn(globalThis, "fetch");
      const res = await agent.get(`/api/foods/barcode/${code}`).expect(200);
      expect(res.body.food).toMatchObject({ id: food.id, verified: true });
      expect(fetch).not.toHaveBeenCalled();
    });

    it("keeps what Open Food Facts knows when it has no nutrition", async () => {
      const { agent } = await t.signIn();
      const code = randomEan13();
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        json(200, {
          product: { product_name: "Aloo Bhujia", brands: "Haldiram's", nutriments: {} },
        }),
      );
      const res = await agent.get(`/api/foods/barcode/${code}`).expect(404);
      expect(res.body.details).toEqual({
        code,
        name: "Aloo Bhujia",
        brand: "Haldiram's",
        imageUrl: null,
      });
      // Cached miss still carries the name.
      const again = await agent.get(`/api/foods/barcode/${code}`).expect(404);
      expect(again.body.details).toMatchObject({ name: "Aloo Bhujia" });
    });

    it("imports a product from Open Food Facts once", async () => {
      const { agent } = await t.signIn();
      const code = randomEan13();
      const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(
        json(200, {
          product: {
            product_name: `Test Cookies ${code}`,
            brands: "Parle",
            serving_size: "1 portion (30 g)",
            serving_quantity: 30,
            nutriments: {
              "energy-kcal_100g": 537,
              proteins_100g: 4.3,
              carbohydrates_100g: 63.3,
              fat_100g: 29.3,
            },
          },
        }),
      );
      const res = await agent.get(`/api/foods/barcode/${code}`).expect(200);
      expect(res.body.food).toMatchObject({
        name: `Test Cookies ${code} (Parle)`,
        source: "OPEN_FOOD_FACTS",
        verified: true,
        barcode: code,
        servingSizeG: 30,
      });
      expect(fetch).toHaveBeenCalledTimes(1);
      await agent.get(`/api/foods/barcode/${code}`).expect(200);
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it("caches a miss and reports a busy product database", async () => {
      const { agent } = await t.signIn();
      const code = randomEan13();
      const fetch = vi.spyOn(globalThis, "fetch").mockImplementation(async () => json(404, {}));
      await agent.get(`/api/foods/barcode/${code}`).expect(404);
      await agent.get(`/api/foods/barcode/${code}`).expect(404);
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(await t.prisma.barcodeMiss.findUnique({ where: { code } })).not.toBeNull();

      fetch.mockImplementation(async () => json(500, {}));
      await agent
        .get(`/api/foods/barcode/${randomEan13()}`)
        .expect(502, { error: "The product database is busy. Try again in a minute." });
    });
  });

  describe("label scans", () => {
    it("validates and checks the photo belongs to the caller", async () => {
      const other = await t.signIn();
      const { agent } = await t.signIn();
      await agent.post("/api/foods/label").send({}).expect(400);
      await agent
        .post("/api/foods/label")
        .send({ photoKey: `meals/${other.userId}/l.jpg` })
        .expect(403, { error: "Photo does not belong to you" });
    });

    it("reports an unreadable photo as 502 without using a scan", async () => {
      const { userId, agent } = await t.signIn();
      await agent
        .post("/api/foods/label")
        .send({ photoKey: `meals/${userId}/l.jpg` })
        .expect(502, { error: "We couldn't read the label. Try again, or type it instead." });
      const call = await t.prisma.aiCall.findFirstOrThrow({ where: { userId } });
      expect(call).toMatchObject({ type: "LABEL_SCAN", success: false, countsAsScan: false });
    });

    it("says so when the photo isn't a label", async () => {
      const { userId, agent } = await t.signIn();
      vi.spyOn(t.app.get(StorageService), "getImage").mockResolvedValue(PNG);
      const extractor = t.app.get<FoodExtractor>(FOOD_EXTRACTOR);
      vi.spyOn(extractor, "readNutritionLabel").mockResolvedValue({
        data: {
          isLabel: false,
          per100g: { kcal: 0, protein: 0, carbs: 0, fat: 0 },
          confidence: 0.1,
        },
        usage: { provider: "mock", model: "mock", latencyMs: 1 },
      } as Awaited<ReturnType<FoodExtractor["readNutritionLabel"]>>);
      await agent
        .post("/api/foods/label")
        .send({ photoKey: `meals/${userId}/l.jpg` })
        .expect(422, {
          error: "That doesn't look like a nutrition table. This didn't use a scan.",
        });
      expect((await agent.get("/api/usage").expect(200)).body.used).toBe(0);
    });

    it("reads a label, shows it to its owner only, then saves the food and logs it", async () => {
      const owner = await t.signIn();
      await onboard(owner.agent);
      const stranger = await t.signIn();
      vi.spyOn(t.app.get(StorageService), "getImage").mockResolvedValue(PNG);
      const photoKey = `meals/${owner.userId}/label.jpg`;
      const code = randomEan13();

      const scan = await owner.agent
        .post("/api/foods/label")
        .send({ photoKey, barcode: code })
        .expect(201);
      expect(scan.body).toEqual({ id: expect.any(String) });
      expect((await owner.agent.get("/api/usage").expect(200)).body.used).toBe(1);

      const read = await owner.agent.get(`/api/foods/label/${scan.body.id}`).expect(200);
      expect(read.body).toEqual({
        id: scan.body.id,
        name: "Mock biscuits",
        per100g: { kcal: 480, protein: 7, carbs: 70, fat: 19, sugar: 25, sodiumMg: 300 },
        servingSizeG: 25,
        servingLabel: "3 biscuits (25 g)",
      });
      await stranger.agent
        .get(`/api/foods/label/${scan.body.id}`)
        .expect(404, { error: "Label scan not found" });

      const save = {
        name: `Mock biscuits ${code}`,
        per100g: { kcal: 480, protein: 7, carbs: 70, fat: 19 },
        servingSizeG: 25,
        quantity: 1,
        unit: "serving",
        grams: 25,
        mealType: "SNACK",
      };
      await owner.agent
        .post(`/api/foods/label/${scan.body.id}/save`)
        .send({ ...save, name: "x" })
        .expect(400);
      await stranger.agent.post(`/api/foods/label/${scan.body.id}/save`).send(save).expect(404);
      // A future day is refused before the food is created.
      const tomorrow = new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10);
      await owner.agent
        .post(`/api/foods/label/${scan.body.id}/save`)
        .send({ ...save, date: tomorrow })
        .expect(400, { error: "You can't log a meal for a future day" });
      expect(await t.prisma.food.count({ where: { name: save.name } })).toBe(0);
      const saved = await owner.agent
        .post(`/api/foods/label/${scan.body.id}/save`)
        .send(save)
        .expect(201);
      expect(saved.body).toEqual({ id: expect.any(String) });

      const meal = await t.prisma.mealLog.findUniqueOrThrow({
        where: { id: saved.body.id },
        include: { items: true },
      });
      expect(meal).toMatchObject({
        userId: owner.userId,
        status: "CONFIRMED",
        source: "PHOTO",
        photoKey,
        totalKcal: 120,
      });
      const food = await t.prisma.food.findUniqueOrThrow({ where: { id: meal.items[0].foodId! } });
      // 480 kcal ≈ 4·7 + 4·70 + 9·19: shared with everyone at once.
      expect(food).toMatchObject({
        source: "LABEL_SCAN",
        verified: true,
        submittedById: owner.userId,
        barcode: code,
      });
      const found = await stranger.agent.get(`/api/foods/barcode/${code}`).expect(200);
      expect(found.body.food.id).toBe(food.id);
    });

    it("keeps a scan whose numbers don't add up private, and lets a checked scan take its barcode", async () => {
      const first = await t.signIn();
      const second = await t.signIn();
      vi.spyOn(t.app.get(StorageService), "getImage").mockResolvedValue(PNG);
      const code = randomEan13();
      const saveScan = async (user: typeof first, kcal: number) => {
        const scan = await user.agent
          .post("/api/foods/label")
          .send({ photoKey: `meals/${user.userId}/l.jpg`, barcode: code })
          .expect(201);
        const saved = await user.agent
          .post(`/api/foods/label/${scan.body.id}/save`)
          .send({
            name: `Scan ${kcal} ${code}`,
            per100g: { kcal, protein: 7, carbs: 70, fat: 19 },
            quantity: 100,
            unit: "g",
            grams: 100,
            mealType: "SNACK",
          })
          .expect(201);
        const meal = await t.prisma.mealLog.findUniqueOrThrow({
          where: { id: saved.body.id },
          include: { items: true },
        });
        return t.prisma.food.findUniqueOrThrow({ where: { id: meal.items[0].foodId! } });
      };

      const wrong = await saveScan(first, 900);
      expect(wrong).toMatchObject({ verified: false, barcode: code });
      await second.agent.get(`/api/foods/barcode/${code}`).expect(404);

      const right = await saveScan(second, 480);
      expect(right).toMatchObject({ verified: true, barcode: code });
      expect(await t.prisma.food.findUniqueOrThrow({ where: { id: wrong.id } })).toMatchObject({
        barcode: null,
      });
      const found = await first.agent.get(`/api/foods/barcode/${code}`).expect(200);
      expect(found.body.food.id).toBe(right.id);
    });
  });

  describe("barcode with every source configured", () => {
    let all: TestApp;
    beforeAll(async () => {
      all = await createTestApp({
        env: {
          USDA_FDC_API_KEY: "usda-key",
          EDAMAM_APP_ID: "ed-id",
          EDAMAM_APP_KEY: "ed-key",
          UPCITEMDB_ENABLED: "true",
        },
      });
    });
    afterAll(() => all.close());

    /** Answers per host; otherwise each source's real "unknown product" reply. */
    const route = (answers: Partial<Record<"off" | "usda" | "edamam" | "upc", () => Response>>) =>
      vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
        const url = String(input instanceof Request ? input.url : input);
        const key = url.includes("openfoodfacts")
          ? "off"
          : url.includes("nal.usda.gov")
            ? "usda"
            : url.includes("edamam")
              ? "edamam"
              : url.includes("upcitemdb")
                ? "upc"
                : null;
        const answer = key ? answers[key] : undefined;
        if (answer) return answer();
        // Like the real APIs: USDA search answers 200 with no foods, the others 404.
        return key === "usda" ? json(200, { foods: [] }) : json(404, {});
      });

    it("asks every source at once and saves the first full answer", async () => {
      const { agent } = await all.signIn();
      const code = randomEan13();
      const fetch = route({
        usda: () =>
          json(200, {
            foods: [
              { gtinUpc: "999", description: "WRONG" },
              {
                gtinUpc: code,
                description: `IMPORTED OATS ${code}`,
                brandOwner: "Quaker",
                foodNutrients: [
                  { nutrientId: 1008, value: 379 },
                  { nutrientId: 1003, value: 13 },
                  { nutrientId: 1005, value: 68 },
                  { nutrientId: 1004, value: 6.5 },
                ],
              },
            ],
          }),
        upc: () => json(200, { items: [{ title: "Quaker Oats" }] }),
      });
      const res = await agent.get(`/api/foods/barcode/${code}`).expect(200);
      expect(res.body.food).toMatchObject({
        source: "USDA",
        verified: true,
        barcode: code,
        kcalPer100g: 379,
      });
      const hosts = fetch.mock.calls.map(([u]) => new URL(String(u)).hostname);
      expect(new Set(hosts)).toEqual(
        new Set([
          "world.openfoodfacts.org",
          "api.nal.usda.gov",
          "api.edamam.com",
          "api.upcitemdb.com",
        ]),
      );
    });

    it("returns a name-only answer to prefill the label scan", async () => {
      const { agent } = await all.signIn();
      const code = randomEan13();
      route({
        upc: () =>
          json(200, {
            items: [{ title: "Parle Monaco", brand: "Parle", images: ["https://u/m.jpg"] }],
          }),
      });
      const res = await agent.get(`/api/foods/barcode/${code}`).expect(404);
      expect(res.body.details).toEqual({
        code,
        name: "Parle Monaco",
        brand: "Parle",
        imageUrl: "https://u/m.jpg",
      });
      expect(await all.prisma.barcodeMiss.findUnique({ where: { code } })).toMatchObject({
        name: "Parle Monaco",
      });
    });

    it("doesn't remember a miss while a source is down, and 502s only when all are", async () => {
      const { agent } = await all.signIn();
      const code = randomEan13();
      route({ usda: () => json(500, {}) });
      await agent.get(`/api/foods/barcode/${code}`).expect(404);
      expect(await all.prisma.barcodeMiss.findUnique({ where: { code } })).toBeNull();

      vi.spyOn(globalThis, "fetch").mockImplementation(async () => json(503, {}));
      await agent
        .get(`/api/foods/barcode/${randomEan13()}`)
        .expect(502, { error: "The product database is busy. Try again in a minute." });
    });
  });
});
