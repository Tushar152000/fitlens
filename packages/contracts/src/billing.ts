import { z } from "zod";

/**
 * FITR8 Pro billing (docs/PREMIUM.md). Purchases happen in the app through RevenueCat; the API
 * learns about them from RevenueCat's webhook and REST API.
 */

export type PlanName = "FREE" | "PRO";

/**
 * POST /api/billing/revenuecat — RevenueCat's webhook body. Only the fields we read are listed;
 * RevenueCat adds fields and event types without notice, so unknown keys pass through.
 */
export const RevenueCatWebhookSchema = z.object({
  api_version: z.string().optional(),
  event: z
    .object({
      id: z.string().min(1).max(128),
      type: z.string().min(1).max(64),
      app_user_id: z.string().max(256).nullish(),
      original_app_user_id: z.string().max(256).nullish(),
      aliases: z.array(z.string().max(256)).max(100).nullish(),
      transferred_from: z.array(z.string().max(256)).max(100).nullish(),
      transferred_to: z.array(z.string().max(256)).max(100).nullish(),
      entitlement_ids: z.array(z.string().max(128)).max(50).nullish(),
      product_id: z.string().max(256).nullish(),
      period_type: z.string().max(32).nullish(),
      store: z.string().max(32).nullish(),
      environment: z.string().max(32).nullish(),
      event_timestamp_ms: z.number().int().nonnegative(),
      expiration_at_ms: z.number().int().nonnegative().nullish(),
      grace_period_expiration_at_ms: z.number().int().nonnegative().nullish(),
    })
    .passthrough(),
});
export type RevenueCatWebhook = z.infer<typeof RevenueCatWebhookSchema>;

/** GET /api/billing and POST /api/billing/refresh — the caller's plan and today's limits. */
export interface BillingDto {
  plan: PlanName;
  /** False until Pro can be bought: clients hide upgrade prompts and keep today's limits. */
  paywall: boolean;
  /** ISO; when Pro access ends (renews before then unless `willRenew` is false). */
  proUntil: string | null;
  lifetime: boolean;
  willRenew: boolean;
  /** Store the subscription was bought in (APP_STORE, PLAY_STORE…), for "manage subscription". */
  store: string | null;
  limits: { scans: number; coach: number; labelScans: boolean };
}
