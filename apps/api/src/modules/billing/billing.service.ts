import { Injectable, Logger } from "@nestjs/common";
import { RevenueCatWebhookSchema, type BillingDto, type PlanName } from "@fitr8/contracts";
import { Prisma } from "@fitr8/db";
import { accessFromEvent, dailyLimits, planOf, type AccessChange } from "@fitr8/domain/billing";
import { safeEqual } from "../../common/crypto.js";
import { AppError } from "../../common/errors.js";
import { InjectEnv, type Env } from "../../config/config.module.js";
import { PrismaService } from "../../infra/prisma/prisma.service.js";
import { InjectRevenueCat, type RevenueCatApi } from "./revenuecat.js";

type Meta = {
  productId?: string | null;
  store?: string | null;
  periodType?: string | null;
  environment?: string | null;
};

/** RevenueCat anonymous ids aren't our users; ours are cuid ids set with Purchases.logIn(userId). */
const isOurId = (id: string) => /^c[a-z0-9]{20,32}$/.test(id);
const isFkViolation = (err: unknown) =>
  err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2003";
const isUniqueViolation = (err: unknown) =>
  err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";

/**
 * FITR8 Pro (docs/PREMIUM.md). Owns entitlements and billing_events. Other modules ask it for a
 * user's plan and limits; RevenueCat tells it about purchases (webhook, or REST after a purchase).
 */
@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectRevenueCat() private readonly revenueCat: RevenueCatApi,
    @InjectEnv() private readonly env: Env,
  ) {}

  get paywall(): boolean {
    return this.env.PAYWALL_ENABLED;
  }

  private async entitlement(userId: string) {
    return this.prisma.entitlement.findUnique({ where: { userId } });
  }

  async plan(userId: string): Promise<PlanName> {
    return planOf(await this.entitlement(userId));
  }

  /** The caller's plan and today's limits, for quotas (scans, coach, label scans). */
  async limits(userId: string) {
    const plan = await this.plan(userId);
    return {
      plan,
      paywall: this.paywall,
      ...dailyLimits(plan, this.paywall, {
        freeScans: this.env.AI_DAILY_LIMIT,
        proScans: this.env.AI_PRO_DAILY_LIMIT,
        freeCoach: this.env.COACH_FREE_DAILY_LIMIT,
        proCoach: this.env.COACH_DAILY_LIMIT,
      }),
    };
  }

  async billing(userId: string): Promise<BillingDto> {
    const row = await this.entitlement(userId);
    const { plan, paywall, scans, coach, labelScans } = await this.limits(userId);
    return {
      plan,
      paywall,
      proUntil: row?.proUntil?.toISOString() ?? null,
      lifetime: row?.lifetime ?? false,
      willRenew: plan === "PRO" && (row?.willRenew ?? false),
      store: row?.store ?? null,
      limits: { scans, coach, labelScans },
    };
  }

  /** After a purchase or "Restore purchases" in the app: read RevenueCat now, don't wait for the webhook. */
  async refresh(userId: string): Promise<BillingDto> {
    if (this.revenueCat.enabled) await this.syncFromRevenueCat(userId);
    return this.billing(userId);
  }

  // ── Webhook ────────────────────────────────────────────────────────────

  /**
   * RevenueCat's webhook. The Authorization header must equal REVENUECAT_WEBHOOK_AUTH. Deliveries
   * are at-least-once: an event id we've handled is acknowledged and skipped. With a secret key we
   * re-read every affected customer from RevenueCat (their advice); without one, the event's own
   * fields are applied, never over a newer state.
   */
  async handleWebhook(authorization: string | undefined, body: unknown): Promise<{ ok: true }> {
    const expected = this.env.REVENUECAT_WEBHOOK_AUTH;
    if (!expected) throw new AppError(503, "Billing webhook is not configured");
    if (!authorization || !safeEqual(authorization, expected))
      throw new AppError(401, "Unauthorized");

    const { event } = RevenueCatWebhookSchema.parse(body);
    if (await this.prisma.billingEvent.findUnique({ where: { id: event.id } })) return { ok: true };

    const ids = [
      ...new Set(
        [
          event.app_user_id,
          event.original_app_user_id,
          ...(event.aliases ?? []),
          ...(event.transferred_from ?? []),
          ...(event.transferred_to ?? []),
        ].filter((id): id is string => Boolean(id) && isOurId(id!)),
      ),
    ];

    if (event.type !== "TEST") {
      if (this.revenueCat.enabled) {
        for (const id of ids) await this.syncFromRevenueCat(id);
      } else {
        const change = accessFromEvent(event, this.env.REVENUECAT_ENTITLEMENT);
        const target = event.app_user_id && isOurId(event.app_user_id) ? event.app_user_id : null;
        if (change && target) {
          await this.apply(target, change, new Date(event.event_timestamp_ms), {
            productId: event.product_id,
            store: event.store,
            periodType: event.period_type,
            environment: event.environment,
          });
        } else if (event.type === "TRANSFER") {
          this.logger.warn("TRANSFER needs REVENUECAT_SECRET_KEY to resolve; skipped");
        }
      }
    }

    await this.prisma.billingEvent
      .create({ data: { id: event.id, type: event.type, userId: ids[0] ?? null } })
      .catch((err) => {
        if (!isUniqueViolation(err)) throw err;
      });
    return { ok: true };
  }

  /** Re-reads one customer from RevenueCat and stores the result (authoritative, newest). */
  async syncFromRevenueCat(userId: string) {
    const access = await this.revenueCat.subscriberAccess(userId).catch((err: Error) => {
      throw new AppError(502, "Couldn't check your subscription. Try again in a moment.", {
        cause: err.message,
      });
    });
    const now = new Date();
    if (access) {
      const { productId, store, periodType, environment, ...change } = access;
      await this.apply(userId, change, now, { productId, store, periodType, environment });
    } else {
      // No Pro at RevenueCat: end any access we stored (refund, expiry, transfer away).
      await this.prisma.entitlement.updateMany({
        where: { userId },
        data: { proUntil: null, lifetime: false, willRenew: false, syncedAt: now },
      });
    }
  }

  /** Stores an access change unless a newer one is already stored. Unknown users are ignored. */
  private async apply(userId: string, change: AccessChange, at: Date, meta: Meta) {
    const current = await this.entitlement(userId);
    if (current && current.syncedAt > at) return;
    const data = {
      proUntil: change.proUntil,
      lifetime: change.lifetime,
      willRenew: change.willRenew,
      productId: meta.productId ?? current?.productId ?? null,
      store: meta.store ?? current?.store ?? null,
      periodType: meta.periodType ?? current?.periodType ?? null,
      environment: meta.environment ?? current?.environment ?? null,
      syncedAt: at,
    };
    try {
      await this.prisma.entitlement.upsert({
        where: { userId },
        create: { userId, ...data },
        update: data,
      });
    } catch (err) {
      if (isFkViolation(err)) return this.logger.warn(`Billing event for unknown user ${userId}`);
      throw err;
    }
  }
}
