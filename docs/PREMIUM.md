# FITR8 Premium

Decided 2026-11-19 (replaces the 2026-10-13 plan of ₹199/month). Bought in the phone app through the
App Store / Google Play (RevenueCat). The web only shows your plan.

## Plans (what users see)

### Free · ₹0 forever

Essential fitness tracking for everyone.

- **Food:** type what you ate, calories and macros, unlimited saved meals
- **Workout:** log sets, reps and weights, unlimited workout history, personal records (PRs)
- **Progress:** weight, body progress and water tracking
- **Reminders:** water and meal reminders, plus up to 3 of your own
- **Health apps:** connect Apple Health or Google Fit

### FITR8 Premium · ₹149/month or ₹1,499/year

More intelligence. Better guidance. Smarter fitness. Everything in Free, plus:

- **Scan your food:** barcode scanning, AI photo scanning (meals and nutrition labels)
- **AI Coach:** your personal nutrition and training coach
- **Personalised workouts:** a weekly plan built for your goal, adjusted every day
- **Insights and reports:** detailed weekly reports, monthly progress reports, health insights
  from Apple Health / Google Fit
- **Unlimited reminders**
- **Data export:** full reports to download

Yearly is about ₹125/month (save ₹289). **7-day free trial**, then ₹149/month or ₹1,499/year.
Cancel anytime; trial eligibility and renewal terms apply.

## Rules (what the code enforces)

| What                          | Free                                   | Premium                     |
| ----------------------------- | -------------------------------------- | --------------------------- |
| AI photo scans (meal + label) | none                                   | 10 a day                    |
| Barcode scanning              | none                                   | ✓                           |
| AI Coach messages             | none                                   | 40 a day                    |
| Personalised workout plan     | none                                   | ✓                           |
| Custom reminders              | 3                                      | unlimited (fair-use cap 50) |
| Weekly / monthly reports      | basic week view                        | detailed                    |
| Data export                   | simple CSV of your data (a user right) | + formatted reports         |
| Health app connection         | ✓                                      | ✓ + insights                |

- **Every Premium feature opens the same Premium screen** when a free user taps it (barcode,
  photo scan, coach, workout plan, 4th reminder, insights, reports). After buying, it unlocks at once.
- **First login:** the Premium screen shows once, right after onboarding ("Your plan is ready"), with
  "Continue with Free". Stores require it to be closable, with Restore purchases and the terms.
- **Profile:** "Go Premium"; Premium users see their plan, renewal date and Manage subscription.
- **Always on:** the rules above apply to every user in every environment; there is no switch. Rules
  and tests: `packages/domain/src/billing` (`dailyLimits`, `isPro`, `accessFromEvent`).

## Buying

- **Now (testing): one-tap test purchase.** While store billing isn't connected (no
  `REVENUECAT_SECRET_KEY` on the API), "Get Premium" calls `POST /api/billing/test-purchase`
  `{period}` and the user is Premium at once for 30 or 365 days, no money involved. The screen says
  "Test purchase: no money is charged". Profile shows "End test Premium" (`DELETE` the same route,
  back to Free). `GET /api/billing` returns `testPurchases: true`. This works in production too, so
  **anyone with the app can get Premium free** until the step below.
- **Before a public store release:** connect store billing (Setup below: store products, RevenueCat,
  `REVENUECAT_ENABLED=true` with its secrets, app SDK keys in a new build). Test purchases then switch
  off by themselves (404) and the app buys through the App Store / Google Play. Apple and Google
  require their own billing for digital subscriptions, so this must happen before the app is public.

## Not built yet (to tackle one by one)

- [ ] **Log your own workout** for free users: pick exercises and enter sets, without the Premium plan.
      Until this exists, the workout plan stays open to free users.
- [ ] **Workout history** screen (unlimited, all past sessions).
- [ ] **Personal records (PRs)** per exercise.
- [ ] **Apple Health and Google Fit** connection (Health Connect on Android; Google Fit's API is being
      retired). See the health integration plan.
- [ ] **Health insights** from that data (Premium).
- [ ] **Detailed weekly reports** and **monthly progress reports** (Premium): define contents first.
- [ ] **Formatted report export** (Premium), beside the free CSV.

## How it works

```
App: Purchases.configure({ appUserID: <FITR8 user id> })  ← identifyPurchaser() after sign-in
App: Premium screen → purchasePackage → POST /api/billing/refresh  (limits lift immediately)
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
- Routes: `GET /api/billing` (plan, renewal, limits, `testPurchases`), `POST /api/billing/refresh`
  (after purchase or restore), `POST/DELETE /api/billing/test-purchase` (testing only),
  `POST /api/billing/revenuecat` (public, header-authenticated). A Premium feature on the free plan
  returns **402** `{ reason: "pro_required", feature }`; a used-up Premium limit returns 429.

## App

- `apps/mobile/src/lib/premium.ts`: the one gate. `usePremium().locked(feature)` reads
  `GET /api/billing` limits; `openPremium(feature)` opens the Premium screen led by that feature;
  `handlePremiumError(err)` does the same for any 402 `pro_required` the API returns.
- Entry points: Today banner (free users, design 14), Profile plan card (14a), and every Premium
  feature a free user taps: photo, barcode and label scanning and the coach open the locked sheet
  (14b, with the free path "Type this meal instead"); a 4th reminder opens the Premium screen. A 402
  from the API (`handlePremiumError`) opens the same sheet. Designs: docs/DESIGN.md "Premium upsell
  and paywall".
- `GET /api/usage` adds `typedMeals {today, thisMonth}` (meals logged by typing) for the banner and
  the Profile usage strip; `GET /api/billing` adds `period` (year / month).
- First login: Today (`usePremiumIntro`) opens Premium once per user (flag in secure storage) for a
  free user whose `profile.onboardedAt` is within the last 24 hours, so it also works after web
  onboarding.
- Premium screen: `apps/mobile/src/app/pro.tsx` (modal), design in docs/DESIGN.md "Premium screen".
  Prices and trial from the store (RevenueCat); without store plans it shows the launch prices and,
  while `testPurchases` is on, buys with the one-tap test purchase. Restore purchases, Terms / Privacy and renewal terms (App Store 3.1.1 / 3.1.2).
- `react-native-purchases` is native: it needs a new EAS build (Expo Go runs it in preview mode,
  no real purchases). Analytics (docs/ANALYTICS.md): `premium_banner_*`, `premium_locked_*`, `paywall_viewed` (source), `paywall_plan_selected`, `paywall_feature_expanded`, `purchase_started/_succeeded/_failed/_cancelled`.

## Setup (once, by you)

1. **Stores** (after the app exists in each store):
   - App Store Connect → Subscriptions → group "FITR8 Premium" → `fitr8_pro_monthly` (₹149) and
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
   `REVENUECAT_ENTITLEMENT` if not `pro`; GitHub variable `REVENUECAT_ENABLED=true` mounts them.
5. **App** (EAS environment variables, then a new build): `EXPO_PUBLIC_REVENUECAT_IOS_KEY`
   (`appl_…`) and `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` (`goog_…`); these public SDK keys are safe in
   the app.
6. Test with a sandbox / licence-tester account: buy, cancel, restore; check `GET /api/billing`.
7. Deploy: test purchases switch off and real purchases take over. Test-Premium users keep Premium
   until their 30/365 days end.
