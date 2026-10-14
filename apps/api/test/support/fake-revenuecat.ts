import type { RevenueCatApi, SubscriberAccess } from "../../src/modules/billing/revenuecat.js";

/**
 * Stands in for RevenueCat's REST API. Off by default (webhooks are applied from their payload);
 * set `enabled` and `set(userId, access)` to simulate a customer's current state.
 */
export class FakeRevenueCat implements RevenueCatApi {
  enabled = false;
  readonly calls: string[] = [];
  private readonly customers = new Map<string, SubscriberAccess>();

  set(appUserId: string, access: SubscriberAccess) {
    this.customers.set(appUserId, access);
  }

  async subscriberAccess(appUserId: string): Promise<SubscriberAccess> {
    this.calls.push(appUserId);
    return this.customers.get(appUserId) ?? null;
  }
}
