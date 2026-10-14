import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestApp, onboardingPayload, type TestApp } from "./support/app.js";

const AUTH = "Bearer test-webhook-secret";
let t: TestApp;
let paywalled: TestApp;
beforeAll(async () => {
  t = await createTestApp({ env: { REVENUECAT_WEBHOOK_AUTH: AUTH } });
  paywalled = await createTestApp({
    env: { REVENUECAT_WEBHOOK_AUTH: AUTH, PAYWALL_ENABLED: "true", COACH_FREE_DAILY_LIMIT: "2" },
  });
});
afterAll(async () => {
  await t.close();
  await paywalled.close();
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
      limits: { scans: 30, coach: 40, labelScans: true },
    });
    expect((await agent.get("/api/usage").expect(200)).body).toMatchObject({
      plan: "PRO",
      limit: 30,
      paywall: false,
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

describe("paywall", () => {
  it("keeps today's limits while the paywall is off", async () => {
    const { agent } = await t.signIn();
    expect((await agent.get("/api/billing").expect(200)).body).toMatchObject({
      plan: "FREE",
      paywall: false,
      limits: { scans: 3, coach: 40, labelScans: true },
    });
  });

  it("with the paywall on: free limits, label scans for Pro only, fewer coach messages", async () => {
    const { userId, agent } = await paywalled.signIn();
    await agent.post("/api/onboarding").send(onboardingPayload()).expect(201);
    expect((await agent.get("/api/usage").expect(200)).body).toMatchObject({
      plan: "FREE",
      limit: 3,
      paywall: true,
    });

    const label = await agent
      .post("/api/foods/label")
      .send({ photoKey: `meals/${userId}/x.jpg` })
      .expect(402);
    expect(label.body.details).toEqual({ reason: "pro_required" });

    const conversation = await paywalled.prisma.coachConversation.create({ data: { userId } });
    await paywalled.prisma.coachMessage.createMany({
      data: [1, 2].map(() => ({
        conversationId: conversation.id,
        role: "user",
        content: [],
        text: "x",
      })),
    });
    const coach = await agent.post("/api/coach/chat").send({ message: "one more" }).expect(429);
    expect(coach.body.error).toMatch(/2 free coach messages/);

    // Buying Pro lifts all three.
    await hook(paywalled, event(userId, "INITIAL_PURCHASE")).expect(200);
    expect((await agent.get("/api/usage").expect(200)).body).toMatchObject({
      plan: "PRO",
      limit: 30,
    });
    const proLabel = await agent
      .post("/api/foods/label")
      .send({ photoKey: `meals/${userId}/x.jpg` });
    expect(proLabel.status).not.toBe(402);
  });
});
