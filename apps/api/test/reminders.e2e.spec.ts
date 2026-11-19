import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { FOOD_EXTRACTOR, type FoodExtractor } from "../src/modules/ai/index.js";
import { createTestApp, type TestApp } from "./support/app.js";

const LOCAL = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

describe("reminders", () => {
  let t: TestApp;
  beforeAll(async () => {
    t = await createTestApp({ premium: true });
  });
  afterEach(() => vi.restoreAllMocks());
  afterAll(() => t.close());

  it("requires sign-in", async () => {
    await t.http().get("/api/reminders").expect(401);
    await t.http().post("/api/reminders").send({}).expect(401);
    await t.http().post("/api/reminders/parse").send({}).expect(401);
    await t.http().patch("/api/reminders/x").send({}).expect(401);
    await t.http().delete("/api/reminders/x").expect(401);
  });

  it("turns words into a draft without saving it", async () => {
    const { agent, userId } = await t.signIn();
    await agent.post("/api/reminders/parse").send({ text: "" }).expect(400);

    const daily = await agent
      .post("/api/reminders/parse")
      .send({ text: "Remind me to take creatine every day at 9 am" })
      .expect(200);
    expect(daily.body).toMatchObject({
      title: "Take creatine",
      description: null,
      crons: ["0 9 * * *"],
      summary: "Every day at 9:00 am",
      rules: [
        {
          cron: "0 9 * * *",
          repeating: true,
          weekly: { minute: 0, hours: [9], weekdays: [0, 1, 2, 3, 4, 5, 6] },
        },
      ],
    });
    expect(daily.body.nextAt).toMatch(LOCAL);

    // Two days, two times, one of them a changing date.
    const monthly = await agent
      .post("/api/reminders/parse")
      .send({
        text: "remind me to brush 9 am in the first of the month and the second last evening of the month 6pm",
      })
      .expect(200);
    expect(monthly.body).toMatchObject({
      title: "Brush",
      crons: ["0 9 1 * *", "0 18 L-1 * *"],
      summary:
        "Every month on the 1st at 9:00 am; and every month on the second-last day at 6:00 pm",
      rules: [
        { repeating: true, weekly: null },
        { repeating: false, weekly: null },
      ],
    });

    expect(await t.prisma.reminder.count({ where: { userId } })).toBe(0);
    expect(await t.prisma.aiCall.count({ where: { userId, type: "REMINDER_PARSE" } })).toBe(2);
  });

  it("says so when the words aren't a reminder or can't be scheduled", async () => {
    const { agent } = await t.signIn();
    const extractor = t.app.get<FoodExtractor>(FOOD_EXTRACTOR);
    const usage = { provider: "mock", model: "mock", latencyMs: 1 };

    vi.spyOn(extractor, "parseReminder").mockResolvedValueOnce({
      data: { isReminder: false, title: "", description: "", crons: ["0 9 * * *"] },
      usage,
    });
    const notOne = await agent
      .post("/api/reminders/parse")
      .send({ text: "hello there" })
      .expect(422);
    expect(notOne.body.error).toMatch(/doesn't sound like a reminder/);

    vi.spyOn(extractor, "parseReminder").mockResolvedValueOnce({
      data: { isReminder: true, title: "Pay rent", description: "", crons: ["0 9 1 * 1"] },
      usage,
    });
    const bad = await agent.post("/api/reminders/parse").send({ text: "rent" }).expect(422);
    expect(bad.body.error).toMatch(/not both/);

    vi.spyOn(extractor, "parseReminder").mockRejectedValueOnce(new Error("model down"));
    await agent.post("/api/reminders/parse").send({ text: "water at 9 am" }).expect(502);
  });

  it("creates, lists, edits, toggles and deletes reminders", async () => {
    const owner = await t.signIn();
    const stranger = await t.signIn();

    await owner.agent
      .post("/api/reminders")
      .send({ title: "", crons: ["0 9 * * *"] })
      .expect(400);
    await owner.agent.post("/api/reminders").send({ title: "x", crons: [] }).expect(400);
    await owner.agent
      .post("/api/reminders")
      .send({ title: "x", crons: ["nonsense"] })
      .expect(400);
    const tooMany = await owner.agent
      .post("/api/reminders")
      .send({ title: "x", crons: ["0 * * * 1-5"] })
      .expect(400);
    expect(tooMany.body.error).toMatch(/120 alerts/);

    const created = await owner.agent
      .post("/api/reminders")
      .send({
        title: "Drink water",
        description: "A glass now",
        crons: ["0 9-21/4 * * *"],
        prompt: "water every 4 hours",
      })
      .expect(201);
    expect(created.body).toMatchObject({
      title: "Drink water",
      description: "A glass now",
      crons: ["0 9,13,17,21 * * *"],
      enabled: true,
      prompt: "water every 4 hours",
      summary: "Every day, every 4 hours from 9:00 am to 9:00 pm",
      slots: [
        { day: null, weekday: null, hour: 9, minute: 0 },
        { day: null, weekday: null, hour: 13, minute: 0 },
        { day: null, weekday: null, hour: 17, minute: 0 },
        { day: null, weekday: null, hour: 21, minute: 0 },
      ],
      upcoming: [],
    });
    const id = created.body.id as string;

    const list = await owner.agent.get("/api/reminders").expect(200);
    expect(list.body).toMatchObject({ max: 50, reminders: [{ id }] });
    expect((await stranger.agent.get("/api/reminders").expect(200)).body.reminders).toEqual([]);

    await stranger.agent.patch(`/api/reminders/${id}`).send({ enabled: false }).expect(404, {
      error: "Reminder not found",
    });
    await stranger.agent.delete(`/api/reminders/${id}`).expect(404);
    await owner.agent
      .patch(`/api/reminders/${id}`)
      .send({ crons: ["0 9 1 * 1"] })
      .expect(400);

    // Changing dates: exact upcoming times for the phone instead of repeating alerts.
    const edited = await owner.agent
      .patch(`/api/reminders/${id}`)
      .send({ enabled: false, crons: ["15 7 * * SAT,SUN", "0 18 L-1 * *"], description: "" })
      .expect(200);
    expect(edited.body).toMatchObject({
      enabled: false,
      description: null,
      crons: ["15 7 * * 0,6", "0 18 L-1 * *"],
      slots: [
        { day: null, weekday: 0, hour: 7, minute: 15 },
        { day: null, weekday: 6, hour: 7, minute: 15 },
      ],
    });
    expect(edited.body.upcoming).toHaveLength(3);
    for (const at of edited.body.upcoming) expect(at).toMatch(/^\d{4}-\d{2}-\d{2}T18:00$/);

    await owner.agent.delete(`/api/reminders/${id}`).expect(204);
    await owner.agent.delete(`/api/reminders/${id}`).expect(404);
  });

  it("caps reminders per account", async () => {
    const { agent, userId } = await t.signIn();
    await t.prisma.reminder.createMany({
      data: Array.from({ length: 50 }, (_, i) => ({
        userId,
        title: `R${i}`,
        crons: ["0 9 * * *"],
      })),
    });
    const res = await agent
      .post("/api/reminders")
      .send({ title: "One more", crons: ["0 9 * * *"] })
      .expect(409);
    expect(res.body.error).toMatch(/up to 50/);
  });
});
