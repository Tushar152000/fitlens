import { describe, expect, it, vi } from "vitest";
import { accessFromSubscriber, RevenueCatClient } from "./revenuecat.js";

describe("accessFromSubscriber", () => {
  const sub = {
    entitlements: {
      pro: {
        expires_date: "2026-11-14T10:00:00Z",
        grace_period_expires_date: null,
        product_identifier: "fitr8_pro_monthly",
      },
    },
    subscriptions: {
      fitr8_pro_monthly: {
        store: "APP_STORE",
        period_type: "trial",
        is_sandbox: true,
        unsubscribe_detected_at: null,
      },
    },
  };

  it("reads the entitlement and its subscription", () => {
    expect(accessFromSubscriber(sub, "pro")).toEqual({
      proUntil: new Date("2026-11-14T10:00:00Z"),
      lifetime: false,
      willRenew: true,
      productId: "fitr8_pro_monthly",
      store: "APP_STORE",
      periodType: "trial",
      environment: "SANDBOX",
    });
  });

  it("uses the grace period when it runs past expiry, and spots a cancelled renewal", () => {
    const grace = accessFromSubscriber(
      {
        entitlements: {
          pro: { ...sub.entitlements.pro, grace_period_expires_date: "2026-11-20T00:00:00Z" },
        },
        subscriptions: {
          fitr8_pro_monthly: {
            ...sub.subscriptions.fitr8_pro_monthly,
            unsubscribe_detected_at: "2026-10-20T00:00:00Z",
          },
        },
      },
      "pro",
    );
    expect(grace?.proUntil).toEqual(new Date("2026-11-20T00:00:00Z"));
    expect(grace?.willRenew).toBe(false);
  });

  it("is lifetime with no expiry, and null without the entitlement", () => {
    expect(
      accessFromSubscriber({ entitlements: { pro: { expires_date: null } } }, "pro"),
    ).toMatchObject({ lifetime: true });
    expect(accessFromSubscriber({ entitlements: {} }, "pro")).toBeNull();
    expect(accessFromSubscriber(sub, "other")).toBeNull();
  });
});

describe("RevenueCatClient", () => {
  it("calls GET /v1/subscribers/{id} with the secret key", async () => {
    const fetchMock = vi.fn(async () => Response.json({ subscriber: { entitlements: {} } }));
    const client = new RevenueCatClient({
      secretKey: "sk_test",
      entitlement: "pro",
      fetch: fetchMock as unknown as typeof fetch,
    });
    await expect(client.subscriberAccess("user 1")).resolves.toBeNull();
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.revenuecat.com/v1/subscribers/user%201");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer sk_test");
  });

  it("is off without a key, and reports errors", async () => {
    expect(new RevenueCatClient({ entitlement: "pro" }).enabled).toBe(false);
    const failing = new RevenueCatClient({
      secretKey: "sk",
      entitlement: "pro",
      fetch: (async () => new Response("{}", { status: 500 })) as unknown as typeof fetch,
    });
    await expect(failing.subscriberAccess("u")).rejects.toThrow(/500/);
  });
});
