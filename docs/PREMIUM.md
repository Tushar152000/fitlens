# FITR8 Pro (RevenueCat)

Decided 2026-10-13: **₹199/month or ₹1,499/year, 7-day free trial**, bought in the phone app
(App Store / Google Play subscriptions through RevenueCat). The web only shows your plan.

## What Pro unlocks

| Feature                                                     | Free                         | Pro                                 |
| ----------------------------------------------------------- | ---------------------------- | ----------------------------------- |
| Typing meals, barcode, usuals, water                        | Unlimited                    | Unlimited                           |
| Daily target, weekly adjustments, plan                      | ✓                            | ✓                                   |
| Photo scans a day                                           | 3 (`AI_DAILY_LIMIT`)         | 30, fair use (`AI_PRO_DAILY_LIMIT`) |
| AI coach messages a day                                     | 5 (`COACH_FREE_DAILY_LIMIT`) | 40 (`COACH_DAILY_LIMIT`)            |
| Photographing nutrition labels                              | –                            | ✓                                   |
| Meal ideas, 30-day insights, calorie cycling, voice logging | –                            | ✓ when built                        |

**Paywall switch.** `PAYWALL_ENABLED` (API) is off by default. Off: free users keep today's limits
(3 scans, the full coach limit, label scans), so nobody loses anything before Pro can be bought;
Pro buyers already get Pro limits. On: the free column above applies. Rules and tests:
`packages/domain/src/billing` (`dailyLimits`, `isPro`, `accessFromEvent`).

## How it works

```
App: Purchases.configure({ appUserID: <FITR8 user id> })  ← identifyPurchaser() after sign-in
App: paywall → purchasePackage → POST /api/billing/refresh  (limits lift immediately)
RevenueCat → POST /api/billing/revenuecat  (webhook; Authorization header = REVENUECAT_WEBHOOK_AUTH)
API: re-reads the customer from RevenueCat (REVENUECAT_SECRET_KEY) → entitlements row
API: /api/me.plan, /api/billing, /api/usage, coach + label checks read BillingService
```

- **`billing` module** (`apps/api/src/modules/billing`) owns `entitlements` (one row per subscriber:
  `proUntil`, `lifetime`, `willRenew`, store, product, environment, `syncedAt`) and `billing_events`
  (webhook ids already handled; RevenueCat delivers at least once and reuses the id on retries).
- With `REVENUECAT_SECRET_KEY` every webhook re-reads the affected customers from
  `GET /v1/subscribers/{id}` (RevenueCat's advice); without it the event's own fields are applied,
  never over a newer state (`event_timestamp_ms` vs `syncedAt`). TRANSFER needs the key.
- Sandbox purchases count (App Review buys in sandbox on the production app).
- Routes: `GET /api/billing` (plan, renewal, limits), `POST /api/billing/refresh` (after purchase or
  restore), `POST /api/billing/revenuecat` (public, header-authenticated). Label scans without Pro
  return **402** `{ reason: "pro_required" }`; limits return 429 with `{ plan, paywall }`.

## App

- `apps/mobile/src/lib/purchases.ts`: configure/identify, plans from the current offering (store
  price strings and free-trial length), buy, restore, "Manage subscription" links.
- Paywall: `apps/mobile/src/app/pro.tsx` (modal). Yearly first with "Save N%", trial CTA, renewal
  terms, Terms / Privacy links, Restore purchases (App Store 3.1.1 / 3.1.2).
- Entry points: "scans used up" sheet (See FITR8 Pro) and Profile (Go Pro; Pro shows renewal and
  Manage subscription). Without an SDK key the app says Pro is coming soon.
- `react-native-purchases` is native: it needs a new EAS build (Expo Go runs it in preview mode,
  no real purchases).

## Setup (once, by you)

1. **Stores** (after the app exists in each store):
   - App Store Connect → Subscriptions → group "FITR8 Pro" → `fitr8_pro_monthly` (₹199) and
     `fitr8_pro_yearly` (₹1,499), each with a 7-day free-trial introductory offer. Paid Apps
     agreement, tax and banking must be complete.
   - Play Console → Monetize → Subscriptions → same two ids, base plans monthly / yearly, a 7-day
     free-trial offer.
2. **RevenueCat** (app.revenuecat.com): project FITR8 → add the iOS app (`com.fitr8.app`, App Store
   Connect API key / in-app purchase key) and the Android app (Play service-account JSON) →
   entitlement **`pro`** with both products → offering **`default`** with a Monthly and an Annual
   package.
3. **Webhook**: Integrations → Webhooks → URL `https://www.fitr8.com/api/billing/revenuecat`,
   Authorization header value = a long random string.
4. **API** (Cloud Run console, secrets via Secret Manager): `REVENUECAT_WEBHOOK_AUTH` (that string),
   `REVENUECAT_SECRET_KEY` (RevenueCat → API keys → secret `sk_…`), optionally
   `REVENUECAT_ENTITLEMENT` if not `pro`. Production refuses `PAYWALL_ENABLED=true` without both.
5. **App** (EAS environment variables, then a new build): `EXPO_PUBLIC_REVENUECAT_IOS_KEY`
   (`appl_…`) and `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` (`goog_…`); these public SDK keys are safe in
   the app.
6. Test with a sandbox / licence-tester account: buy, cancel, restore; check `GET /api/billing`.
7. When ready to charge: set `PAYWALL_ENABLED=true` on the API.
