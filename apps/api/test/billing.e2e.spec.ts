import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestApp, onboardingPayload, type TestApp } from "./support/app.js";

const AUTH = "Bearer test-webhook-secret";
let t: TestApp;
beforeAll(async () => {
  t = await createTestApp({ env: { REVENUECAT_WEBHOOK_AUTH: AUTH } });
});
afterAll(async () => {
  await t.close();
});

const DAY = 86_400_000;
const event = (userId: string, type: string, over: Record<string, unknown> = {}) => ({
  api_version: "1.0",
  event: {
    id: randomUUID(),
    type,
    app_user_id: userId,
    original_app_user_id: userId,
    aliases: [userId],
    entitlement_ids: ["pro"],
    product_id: "fitr8_pro_monthly",
    period_type: "TRIAL",
    store: "APP_STORE",
    environment: "SANDBOX",
    event_timestamp_ms: Date.now(),
    expiration_at_ms: Date.now() + 30 * DAY,
    ...over,
  },
});
const hook = (app: TestApp, body: object, auth = AUTH) =>
  app.http().post("/api/billing/revenuecat").set("Authorization", auth).send(body);

describe("RevenueCat webhook", () => {
  it("is refused when not configured, without or with a wrong secret, and with a bad body", async () => {
    const plain = await createTestApp();
    await plain.http().post("/api/billing/revenuecat").send(event("x", "TEST")).expect(503);
    await plain.close();
    await t.http().post("/api/billing/revenuecat").send(event("x", "TEST")).expect(401);
    await hook(t, event("x", "TEST"), "Bearer wrong").expect(401);
    await hook(t, { event: { type: "INITIAL_PURCHASE" } }).expect(400);
  });

  it("grants Pro on a purchase: plan, renewal and Pro limits", async () => {
    const { userId, agent } = await t.signIn();
    await hook(t, event(userId, "INITIAL_PURCHASE")).expect(200);
    expect((await agent.get("/api/me").expect(200)).body.plan).toBe("PRO");
    const billing = (await agent.get("/api/billing").expect(200)).body;
    expect(billing).toMatchObject({
      plan: "PRO",
      willRenew: true,
      store: "APP_STORE",
      limits: { scans: 10, coach: 40, labelScans: true, barcode: true, reminders: 50 },
    });
    expect((await agent.get("/api/usage").expect(200)).body).toMatchObject({
      plan: "PRO",
      limit: 10,
    });
  });

  it("handles a repeated delivery once, and never lets an older event undo a newer one", async () => {
    const { userId, agent } = await t.signIn();
    const purchase = event(userId, "INITIAL_PURCHASE");
    await hook(t, purchase).expect(200);
    // Same id again, now claiming expiry: ignored.
    await hook(t, {
      ...purchase,
      event: { ...purchase.event, type: "EXPIRATION", expiration_at_ms: Date.now() - DAY },
    }).expect(200);
    // An older expiration arriving late: ignored.
    await hook(
      t,
      event(userId, "EXPIRATION", {
        event_timestamp_ms: Date.now() - DAY,
        expiration_at_ms: Date.now() - DAY,
      }),
    ).expect(200);
    expect((await agent.get("/api/me").expect(200)).body.plan).toBe("PRO");
    // A newer expiration ends Pro.
    await hook(
      t,
      event(userId, "EXPIRATION", {
        event_timestamp_ms: Date.now() + 1000,
        expiration_at_ms: Date.now() - 1,
      }),
    ).expect(200);
    expect((await agent.get("/api/me").expect(200)).body.plan).toBe("FREE");
  });

  it("keeps Pro after cancelling until the period ends", async () => {
    const { userId, agent } = await t.signIn();
    await hook(t, event(userId, "INITIAL_PURCHASE")).expect(200);
    await hook(t, event(userId, "CANCELLATION", { event_timestamp_ms: Date.now() + 1000 })).expect(
      200,
    );
    expect((await agent.get("/api/billing").expect(200)).body).toMatchObject({
      plan: "PRO",
      willRenew: false,
    });
  });

  it("acknowledges test events and unknown or anonymous customers", async () => {
    await hook(t, event("$RCAnonymousID:abc", "INITIAL_PURCHASE")).expect(200);
    await hook(t, event("cnotarealuser0000000000000", "INITIAL_PURCHASE")).expect(200);
    await hook(t, event("x", "TEST")).expect(200);
  });

  it("re-reads the customer from RevenueCat when a secret key is set (and on refresh)", async () => {
    const { userId, agent } = await t.signIn();
    t.revenueCat.enabled = true;
    try {
      t.revenueCat.set(userId, {
        proUntil: new Date(Date.now() + 365 * DAY),
        lifetime: false,
        willRenew: true,
        productId: "fitr8_pro_yearly",
        store: "PLAY_STORE",
        periodType: "NORMAL",
        environment: "PRODUCTION",
      });
      await hook(t, event(userId, "RENEWAL", { product_id: "ignored" })).expect(200);
      expect(t.revenueCat.calls).toContain(userId);
      expect((await agent.get("/api/billing").expect(200)).body).toMatchObject({
        plan: "PRO",
        store: "PLAY_STORE",
      });

      t.revenueCat.set(userId, null); // refunded at RevenueCat
      expect((await agent.post("/api/billing/refresh").expect(200)).body.plan).toBe("FREE");
    } finally {
      t.revenueCat.enabled = false;
    }
  });
});

describe("Premium features", () => {
  it("answer 402 for their feature on the free plan, and buying Premium lifts them", async () => {
    const { userId, agent } = await t.signIn();
    await agent.post("/api/onboarding").send(onboardingPayload()).expect(201);
    expect((await agent.get("/api/billing").expect(200)).body).toMatchObject({
      plan: "FREE",
      limits: { scans: 0, coach: 0, labelScans: false, barcode: false, reminders: 3 },
    });
    const proRequired = (feature: string) => ({ reason: "pro_required", feature });

    const photo = await agent
      .post("/api/meals")
      .send({ source: "PHOTO", mealType: "LUNCH", photoKey: `meals/${userId}/a.jpg` })
      .expect(402);
    expect(photo.body.details).toEqual(proRequired("photo_scan"));

    const label = await agent
      .post("/api/foods/label")
      .send({ photoKey: `meals/${userId}/x.jpg` })
      .expect(402);
    expect(label.body.details).toEqual(proRequired("label_scan"));

    const barcode = await agent.get("/api/foods/barcode/8901058000290").expect(402);
    expect(barcode.body.details).toEqual(proRequired("barcode"));

    const coach = await agent.post("/api/coach/chat").send({ message: "hi" }).expect(402);
    expect(coach.body.details).toEqual(proRequired("coach"));

    for (const n of [1, 2, 3]) {
      await agent
        .post("/api/reminders")
        .send({ title: `Reminder ${n}`, crons: ["0 9 * * *"] })
        .expect(201);
    }
    const fourth = await agent
      .post("/api/reminders")
      .send({ title: "Reminder 4", crons: ["0 9 * * *"] })
      .expect(402);
    expect(fourth.body.details).toEqual(proRequired("reminders"));
    expect((await agent.get("/api/reminders").expect(200)).body.max).toBe(3);

    // Buying Premium lifts every one of them.
    await hook(t, event(userId, "INITIAL_PURCHASE")).expect(200);
    expect((await agent.get("/api/usage").expect(200)).body).toMatchObject({
      plan: "PRO",
      limit: 10,
    });
    expect((await agent.get("/api/foods/barcode/8901058000290")).status).not.toBe(402);
    expect(
      (await agent.post("/api/foods/label").send({ photoKey: `meals/${userId}/x.jpg` })).status,
    ).not.toBe(402);
    expect((await agent.post("/api/coach/chat").send({ message: "hi" })).status).toBe(200);
    await agent
      .post("/api/reminders")
      .send({ title: "Reminder 4", crons: ["0 9 * * *"] })
      .expect(201);
    expect((await agent.get("/api/reminders").expect(200)).body.max).toBe(50);
  });
});

describe("test purchases (store billing not connected)", () => {
  it("give Premium in one tap for 30 or 365 days, and can be ended", async () => {
    const { agent } = await t.signIn();
    await t.http().post("/api/billing/test-purchase").send({ period: "month" }).expect(401);
    await agent.post("/api/billing/test-purchase").send({ period: "week" }).expect(400);

    const month = await agent
      .post("/api/billing/test-purchase")
      .send({ period: "month" })
      .expect(200);
    expect(month.body).toMatchObject({
      plan: "PRO",
      store: "TEST",
      period: "month",
      willRenew: false,
      testPurchases: true,
      limits: { scans: 10, coach: 40, barcode: true, reminders: 50 },
    });
    const days = (iso: string) => Math.round((new Date(iso).getTime() - Date.now()) / DAY);
    expect(days(month.body.proUntil)).toBe(30);

    const year = await agent
      .post("/api/billing/test-purchase")
      .send({ period: "year" })
      .expect(200);
    expect(days(year.body.proUntil)).toBe(365);
    expect(year.body.period).toBe("year");

    const ended = await agent.delete("/api/billing/test-purchase").expect(200);
    expect(ended.body).toMatchObject({ plan: "FREE", proUntil: null, store: null });
  });

  it("are refused once store billing is connected", async () => {
    const { agent } = await t.signIn();
    t.revenueCat.enabled = true;
    try {
      expect((await agent.get("/api/billing").expect(200)).body.testPurchases).toBe(false);
      await agent.post("/api/billing/test-purchase").send({ period: "month" }).expect(404);
      await agent.delete("/api/billing/test-purchase").expect(404);
    } finally {
      t.revenueCat.enabled = false;
    }
  });
});
