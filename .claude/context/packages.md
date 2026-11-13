# packages — domain, contracts, db

## @fitr8/domain (`packages/domain/src`, pure, zod only)

Subpath exports (`package.json`): `./nutrition ./training ./dates ./format ./barcode ./label ./billing`, resolved from `dist/` (build first; turbo `^build` handles it).

- **nutrition/**: `body.ts` (ACTIVITY_FACTORS, `bmi`, `bodyFatNavy` (null on invalid / outside 2–70%), `bmr` Mifflin-St Jeor, `tdee`, `ageFromBirthDate` uses local-time getters); `macros.ts` (`macrosFor`: protein 1.8 g/kg fat loss else 1.6; fat max(25% kcal, 0.6 g/kg); carbs remainder ≥0 — can exceed kcal for heavy users at floor; `scaleNutrition`, `sumMacros`); `goal.ts` (`KCAL_PER_KG_FAT` 7700, floor 1500 M / 1200 F, `LIMITS`, `resolveTargetWeight`, `planGoal` → targets, feasibility, `suggestedTargetDate`, `closerTargetWeightKg`; under-18 or medical flag → no adjustment); `water.ts` (`waterTarget` 33 ml/kg + activity + 500 training, clamp 1500–4500); `preview.ts` (`previewTarget`, `PREVIEW_WEEKS` 12, `PREVIEW_PACE_PCT`) — web landing only.
- **training/**: `types.ts` (`WeekPlanSchema` = `WorkoutPlan.plan` JSON shape), `dose.ts` (`caloriePhase`, `doseFor`, `isDeloadWeek`), `split.ts` (`splitFor`, `exercisesFor`, `REST_SEC`), `library.ts` (61 `EXERCISES`, `EXERCISE_BY_SLUG`, `ruledOutByInjury`), `progression.ts` (`startingLoad`, `nextTarget` double progression), `plan.ts` (`buildWeek`), `adjust.ts` (`adjustSession`, `fuelStatus`, `pickSnack`), `fuel.ts`, `checkin.ts` (`reviewTraining` — not wired to any app).
- **billing/index.ts**: `isPro`, `planOf`, `dailyLimits(plan, paywall, cfg)`, `accessFromEvent(event, entitlementId)`.
- **dates.ts**: `localDate(tz='Asia/Kolkata')`, `parseDateOnly` (Invalid Date on bad input), `weekStart` (Monday), `startOfLocalDay`.
- **format.ts**, **barcode.ts** (GS1, UPC-E→A, `normalizeBarcode`), **label.ts** (`labelAddsUp`).
- Tests: nutrition, preview, water, training, billing, barcode, label. Untested exports include `bmiCategory`, `ageFromBirthDate`, `sumMacros`, `parseDateOnly`, `ruledOutByInjury`, `roundToStep`, `estimateMinutes`, several format helpers (ARCHITECTURE's "100% tested" is false).

## @fitr8/contracts (`packages/contracts/src`, zod 4)

- `requests.ts`: Onboarding, UploadUrl, CreateMeal (PHOTO/TEXT/MANUAL), ConfirmMeal, Recheck, Checkin, ParseItems, Relog, GoalOption, Reminders, PreferredName, WaterAdd, QuickAdd, LabelScan, LabelSave, Energy, WorkoutLog, LogItems.
- `auth.ts` (GoogleStartQuery, MobileStartQuery, MobileToken, AppleSignIn, DevLogin; ProvidersDto, AuthTokenDto, SessionDto), `billing.ts` (RevenueCatWebhookSchema passthrough, BillingDto), `coach.ts` (CoachChatSchema, CoachStreamEvent), `ai.ts` (MealAnalysisSchema, LabelReadSchema), `responses.ts` (all DTOs, `Jsonify`), `analytics.ts` (type-only `AnalyticsEvents` map shared by web + app GA; `export type *`).
- Loose spots: `OnboardingSchema.timezone` any string (invalid IANA → 500); `ConfirmMealSchema.items` no max; `mealAnalysisJsonSchema`/`labelReadJsonSchema` unused. No tests in this package.

## @fitr8/db (`packages/db`)

- Prisma 7, `prisma-client` generator, ESM, output `src/generated/prisma` (gitignored; run `pnpm db:generate` after schema changes). `src/index.ts` exports `createPrismaClient` (PrismaPg).
- Schema `prisma/schema.prisma` — tables: users, auth_identities, sessions, auth_codes, auth_events, profiles, goals, daily_targets (append-only history), body_metrics (unique userId+date), foods (unique name, unique barcode, `verified`, `submittedById` no FK), barcode_misses, label_scans, food_units, meal_logs (status PENDING→ANALYZING→READY→CONFIRMED|FAILED), meal_items, exercises (unused by API), workout_plans (unique userId+weekStart+version), workout_logs (no unique), checkins (unused), ai_calls, water_logs, coach_conversations, coach_messages (append-only `content` JSON), entitlements, billing_events.
- All user-owned tables cascade on user delete; ai_calls SET NULL. No soft deletes.
- Migrations (12, latest `foreign_key_indexes`: indexes on auth_codes.userId, daily_targets.goalId, meal_items.foodId, workout_logs.planId). `pnpm db:drift` (needs `SHADOW_DATABASE_URL`) proves migrations == schema; CI runs it.
- Earlier migrations (11): init → meal note/liquids → scan quota → reminders → barcode foods → exercise library → water → coach agent → auth_sessions (irreversible; replaced Auth.js tables) → apple sign-in → pro entitlements. Schema matches final migration (manual check).
- `prisma/seed.ts`: 32 placeholder foods (header says replace with IFCT/INDB before launch) + exercises mirror. Seed in prod is a manual Cloud Run job execution.
