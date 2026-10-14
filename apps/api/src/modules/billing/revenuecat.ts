import { Inject } from "@nestjs/common";
import type { AccessChange } from "@fitr8/domain/billing";

/** A customer's Pro state as RevenueCat reports it now, or null when they don't have Pro. */
export type SubscriberAccess =
  | (AccessChange & {
      productId: string | null;
      store: string | null;
      periodType: string | null;
      environment: string | null;
    })
  | null;

/** Port for RevenueCat's REST API. Tests swap in a fake; feature code never calls fetch. */
export interface RevenueCatApi {
  /** False without REVENUECAT_SECRET_KEY: webhooks are applied from their own payload. */
  readonly enabled: boolean;
  subscriberAccess(appUserId: string): Promise<SubscriberAccess>;
}

export const REVENUECAT = Symbol("REVENUECAT");
export const InjectRevenueCat = () => Inject(REVENUECAT);

export class RevenueCatError extends Error {
  override name = "RevenueCatError";
}

type Subscriber = {
  entitlements?: Record<
    string,
    {
      expires_date?: string | null;
      grace_period_expires_date?: string | null;
      product_identifier?: string;
    }
  >;
  subscriptions?: Record<
    string,
    {
      store?: string;
      period_type?: string;
      is_sandbox?: boolean;
      unsubscribe_detected_at?: string | null;
    }
  >;
};

/** GET https://api.revenuecat.com/v1/subscribers/{id}, read for one entitlement. */
export class RevenueCatClient implements RevenueCatApi {
  constructor(
    private readonly config: {
      secretKey?: string;
      entitlement: string;
      fetch?: typeof fetch;
      timeoutMs?: number;
    },
  ) {}

  get enabled() {
    return Boolean(this.config.secretKey);
  }

  async subscriberAccess(appUserId: string): Promise<SubscriberAccess> {
    if (!this.enabled) throw new RevenueCatError("RevenueCat is not configured");
    let res: Response;
    try {
      res = await (this.config.fetch ?? fetch)(
        `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(appUserId)}`,
        {
          headers: { Authorization: `Bearer ${this.config.secretKey}`, Accept: "application/json" },
          signal: AbortSignal.timeout(this.config.timeoutMs ?? 10_000),
        },
      );
    } catch {
      throw new RevenueCatError("Couldn't reach RevenueCat");
    }
    if (!res.ok) throw new RevenueCatError(`RevenueCat subscribers: ${res.status}`);
    const body = (await res.json().catch(() => null)) as { subscriber?: Subscriber } | null;
    return accessFromSubscriber(body?.subscriber ?? {}, this.config.entitlement);
  }
}

/** Exported for tests: the subscriber JSON → our access fields. */
export function accessFromSubscriber(sub: Subscriber, entitlement: string): SubscriberAccess {
  const ent = sub.entitlements?.[entitlement];
  if (!ent) return null;
  const date = (v?: string | null) => (v ? new Date(v) : null);
  const expires = date(ent.expires_date);
  const grace = date(ent.grace_period_expires_date);
  const proUntil = expires && grace && grace > expires ? grace : expires;
  const product = ent.product_identifier ?? null;
  const subscription = product ? sub.subscriptions?.[product] : undefined;
  return {
    proUntil,
    lifetime: expires === null,
    willRenew: Boolean(subscription && !subscription.unsubscribe_detected_at && expires),
    productId: product,
    store: subscription?.store ?? null,
    periodType: subscription?.period_type ?? null,
    environment: subscription ? (subscription.is_sandbox ? "SANDBOX" : "PRODUCTION") : null,
  };
}
