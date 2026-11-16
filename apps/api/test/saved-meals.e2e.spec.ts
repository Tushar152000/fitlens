import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestApp, onboard, type TestApp } from "./support/app.js";

describe("saved meals", () => {
  let t: TestApp;
  beforeAll(async () => {
    t = await createTestApp();
  });
  afterAll(() => t.close());

  const user = async () => {
    const u = await t.signIn();
    await onboard(u.agent);
    return u;
  };

  it("requires sign-in", async () => {
    const http = t.http;
    await http().get("/api/saved-meals").expect(401);
    await http().post("/api/saved-meals").send({}).expect(401);
    await http().put("/api/saved-meals/x").send({}).expect(401);
    await http().delete("/api/saved-meals/x").expect(401);
    await http().post("/api/saved-meals/x/log").send({}).expect(401);
  });

  it("builds, edits, logs and deletes a saved meal", async () => {
    const owner = await user();
    const stranger = await user();
    const banana = await t.prisma.food.findUniqueOrThrow({ where: { name: "banana" } });

    // 400: no name, no items, bad amounts.
    await owner.agent.post("/api/saved-meals").send({ name: "", items: [] }).expect(400);
    await owner.agent
      .post("/api/saved-meals")
      .send({ name: "Bad", items: [{ name: "x", quantity: 0, unit: "g", grams: 1 }] })
      .expect(400);
    await owner.agent
      .post("/api/saved-meals")
      .send({
        name: "Ghost",
        items: [{ foodId: "nope", name: "x", quantity: 1, unit: "g", grams: 10 }],
      })
      .expect(404, { error: "Food not found" });

    const created = await owner.agent
      .post("/api/saved-meals")
      .send({
        name: "  Morning fuel ",
        mealType: "BREAKFAST",
        items: [
          { foodId: banana.id, name: "banana", quantity: 1, unit: "piece", grams: 118 },
          // Not in the food list: keeps the user's own per-100 g values.
          {
            name: "protein shake",
            quantity: 1,
            unit: "scoop",
            grams: 40,
            per100g: { kcal: 380, protein: 75, carbs: 10, fat: 5 },
            isLiquid: true,
          },
        ],
      })
      .expect(201);
    expect(created.body).toMatchObject({
      name: "Morning fuel",
      mealType: "BREAKFAST",
      kcal: 105 + 152,
      timesLogged: 0,
      lastLoggedAt: null,
      items: [
        { name: "banana", foodId: banana.id, approximate: false, kcal: 105 },
        { name: "protein shake", foodId: null, approximate: true, kcal: 152, isLiquid: true },
      ],
    });
    const id = created.body.id as string;

    const list = await owner.agent.get("/api/saved-meals").expect(200);
    expect(list.body.savedMeals.map((m: { id: string }) => m.id)).toEqual([id]);
    expect((await stranger.agent.get("/api/saved-meals").expect(200)).body.savedMeals).toEqual([]);

    // Someone else's saved meal is invisible.
    const edit = {
      name: "Morning fuel",
      mealType: null,
      items: [{ foodId: banana.id, name: "banana", quantity: 2, unit: "piece", grams: 236 }],
    };
    await stranger.agent
      .put(`/api/saved-meals/${id}`)
      .send(edit)
      .expect(404, { error: "Saved meal not found" });
    await stranger.agent.post(`/api/saved-meals/${id}/log`).send({ mealType: "SNACK" }).expect(404);
    await stranger.agent.delete(`/api/saved-meals/${id}`).expect(404);

    const updated = await owner.agent.put(`/api/saved-meals/${id}`).send(edit).expect(200);
    expect(updated.body).toMatchObject({ mealType: null, kcal: 210, items: [{ quantity: 2 }] });

    // Log it: 400 without a slot or with a future day, then a confirmed copy.
    await owner.agent.post(`/api/saved-meals/${id}/log`).send({}).expect(400);
    await owner.agent
      .post(`/api/saved-meals/${id}/log`)
      .send({ mealType: "SNACK", date: "2999-01-01" })
      .expect(400);
    const logged = await owner.agent
      .post(`/api/saved-meals/${id}/log`)
      .send({ mealType: "SNACK" })
      .expect(201);
    expect(logged.body).toEqual({ id: expect.any(String) });
    const meal = await t.prisma.mealLog.findUniqueOrThrow({
      where: { id: logged.body.id },
      include: { items: true },
    });
    expect(meal).toMatchObject({
      userId: owner.userId,
      status: "CONFIRMED",
      mealType: "SNACK",
      totalKcal: 210,
    });
    expect(meal.items).toMatchObject([{ foodId: banana.id, quantity: 2, grams: 236 }]);
    const after = (await owner.agent.get("/api/saved-meals").expect(200)).body.savedMeals[0];
    expect(after.timesLogged).toBe(1);
    expect(after.lastLoggedAt).toEqual(expect.any(String));

    await owner.agent.delete(`/api/saved-meals/${id}`).expect(204);
    await owner.agent.delete(`/api/saved-meals/${id}`).expect(404);
  });

  it("hides other people's unreviewed label foods and caps the count", async () => {
    const owner = await user();
    const stranger = await t.signIn();
    const privateFood = await t.prisma.food.create({
      data: {
        name: `private bar ${Date.now()}`,
        source: "LABEL_SCAN",
        verified: false,
        submittedById: stranger.userId,
        kcalPer100g: 400,
        proteinPer100g: 20,
        carbsPer100g: 50,
        fatPer100g: 10,
      },
    });
    const item = { foodId: privateFood.id, name: "bar", quantity: 1, unit: "piece", grams: 40 };
    await owner.agent
      .post("/api/saved-meals")
      .send({ name: "Bar", items: [item] })
      .expect(404);
    await stranger.agent
      .post("/api/saved-meals")
      .send({ name: "Bar", items: [item] })
      .expect(201);

    await t.prisma.savedMeal.createMany({
      data: Array.from({ length: 50 }, (_, i) => ({ userId: owner.userId, name: `Meal ${i}` })),
    });
    const full = await owner.agent
      .post("/api/saved-meals")
      .send({ name: "One more", items: [{ name: "idli", quantity: 1, unit: "piece", grams: 40 }] })
      .expect(409);
    expect(full.body.error).toMatch(/up to 50/);
  });
});
