# Onboarding: spec and backend design

The single reference for onboarding. Part 1 is what the Figma design asks for, Part 2 compares it with the MVP, and Part 3 is the backend design. Update this file when the design or the decisions change. Don't re-derive them from Figma.

- **Source:** Figma "Ganesh's Work" → Page 8 → Section 1 (`3745:1030`), read 2026-10-02. App name in the design: **fitr8**.
- **Screens:** `docs/onboarding/*.png` (exported from the frames below).
- **Status:** Part 3 is the agreed design. Decisions are in §3.11.

---

## Part 1 — The design

### 1.1 Flow

```
Splash → Welcome ─(Sign Up For Free | Log In)→ Google sign-in
       → Name → Goal → Activity → Training: where → Training: schedule
       → About you → Body → Weekly goal → (plan / home: not in the design yet)
```

- Sign-in happens **before** the questions (Welcome has the only sign-up/log-in buttons). So every onboarding API call is authenticated, and answers can be saved on the server as the user goes.
- Every question screen has the same layout:
  - a header with the section label: Welcome, Goals, Training, You
  - a segmented progress bar
  - a circular **back** button and a primary **Next** button
- Selection controls look like checkboxes inside cards. Every screen except days-per-week behaves as **pick one**. Weekly goal says "Pick one" outright. Days-per-week uses chips, with the selected chip filled purple.

### 1.2 Screens and fields

| #   | Figma node  | Header       | Title / helper copy                                                                                                                   | Field                                   | Control                                  | Options / format                                                                                                                                                                                                                    |
| --- | ----------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0   | `3710:1063` | —            | Splash: fitr8 logo                                                                                                                    | —                                       | —                                        | —                                                                                                                                                                                                                                   |
| 1   | `3703:3`    | "Welcome to" | Carousel ("Know what you're actually eating.", 3 dots)                                                                                | —                                       | **Sign Up For Free**, **Log In**         | Both start Google sign-in                                                                                                                                                                                                           |
| 2   | `3711:160`  | Welcome      | "First, what can we call you?" / "We'd like to get to know you."                                                                      | `preferredName`                         | Text input "Preferred first name"        | Free text                                                                                                                                                                                                                           |
| 3   | `3711:2370` | Goals        | "Hey, {name}. Let's start with your goals." / "Setup up your goal"                                                                    | `goal`                                  | Option cards                             | Lose weight · Gain weight · Gain muscle · Recomposition · Healthy body                                                                                                                                                              |
| 4   | `3715:2670` | Goals        | "What is your baseline activity level?" / "**Not including workouts** – we count that separately" / "Choose what describes you best:" | `activityLevel`                         | Option cards with subtitle               | Mostly sitting · Lightly active · Moderately active · Very active · Athlete (subtitles are placeholders: all read "Desk job, under 5k steps")                                                                                       |
| 5   | `3739:672`  | Training     | "How you train?" / "Where you train?"                                                                                                 | `trainingLocation`                      | Option cards with subtitle               | Gym – Machines, barbells · Home – A few dumbbells · Anywhere – No equipment                                                                                                                                                         |
| 6   | `3741:837`  | Training     | "How you train?" / "Days per week", "Activity per session"                                                                            | `trainingDaysPerWeek`, `sessionMinutes` | Chips; number input with a "Min" suffix  | 2–7 days; minutes typed freely                                                                                                                                                                                                      |
| 7   | `3734:327`  | You          | "Tell us a little bit about yourself"                                                                                                 | `sex`, `age`, `country`                 | Two option cards; number input; dropdown | Male · Female; "How old are you?"; "Select country". Helper: "We use sex at birth and age to calculate an accurate goal for you"                                                                                                    |
| 8   | `3735:480`  | You          | "Just a few more questions"                                                                                                           | `height`, `weight`, `goalWeight`        | Number inputs with a unit toggle         | Height: ft + in (two boxes) ↔ cm. Weight and goal weight: kg ↔ lb. Helpers: "It's OK to estimate, you can update later"; goal weight: "Don't worry. This doesn't affect your daily calorie goal and you can always change it later" |
| 9   | `3742:943`  | You          | "What is your weekly goal?" / "Pick one"                                                                                              | `weeklyRateKg`                          | Option cards                             | Mock shows a gain goal: "Gain 0.25 kg per week" · "Gain 0.5 kg per week" (the options must depend on the goal)                                                                                                                      |

Notes from the frames:

- Loose frames `3737:585`, `3737:603` and `3736:550` are drafts of the unit toggle, mislabelled ("How much do you weigh?" with ft/in). They confirm that **height and weight both switch units**.
- Screen 3's greeting uses the name from screen 2. Screen 8's height helper text is a copy-paste placeholder.
- The design has no plan or summary screen after screen 9.

## Part 2 — Gap analysis against the MVP

The MVP onboarding is 3 steps plus a plan screen (`docs/DESIGN.md` §Onboarding, `OnboardingSchema` in `packages/contracts/src/requests.ts`), submitted in one `POST /api/onboarding`.

| Topic                         | MVP                                                    | New design                                                                          | Impact                                                              |
| ----------------------------- | ------------------------------------------------------ | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Name                          | Google profile name                                    | **Asks for a preferred first name**                                                 | New field                                                           |
| Goal types                    | FAT_LOSS, MUSCLE_GAIN, RECOMPOSITION                   | **+ Gain weight, Healthy body** (Lose weight ≈ FAT_LOSS, Gain muscle ≈ MUSCLE_GAIN) | Enum migration; domain needs rules for GAIN_WEIGHT and HEALTHY_BODY |
| Goal target                   | Target weight **or** body-fat % **plus a target date** | Goal weight **plus a weekly rate**, no date                                         | Domain change: plan from a rate (the date becomes an output)        |
| Activity                      | 5 levels                                               | Same 5 levels (labels differ)                                                       | Maps 1:1 to `ActivityLevel`                                         |
| Where you train               | FULL_GYM / DUMBBELLS / BODYWEIGHT                      | Gym / Home / Anywhere                                                               | Maps 1:1 to `Equipment`                                             |
| Days per week                 | 2–6                                                    | **2–7**                                                                             | Domain `splitFor` caps at 6: needs a 7-day split or a cap           |
| Session length                | Segmented 30/45/60 (15–120 allowed)                    | **Free number** in minutes                                                          | Needs a sane range                                                  |
| Age                           | Birth date                                             | **Age in years**                                                                    | Store so it stays correct over time (§3.4)                          |
| Country                       | —                                                      | **New**                                                                             | ISO 3166-1 alpha-2                                                  |
| Units                         | Metric only                                            | **cm or ft/in; kg or lb**                                                           | Store metric, remember the user's preference                        |
| Waist / neck / hip            | Optional, needed for body-fat goals                    | Not asked                                                                           | Body-fat goals go away                                              |
| Diet type                     | Asked (veg, non-veg, …)                                | **Not asked**                                                                       | Used by meals, AI prompts and the coach: §3.11 #4                   |
| Experience                    | Asked                                                  | **Not asked**                                                                       | Used by workouts: §3.11 #4                                          |
| Injuries                      | Asked                                                  | **Not asked**                                                                       | Used by workouts: §3.11 #4                                          |
| Medical / pregnant / under-18 | Checkbox → no deficit                                  | **Not asked**                                                                       | Safety: §3.11 #5                                                    |
| Plan screen                   | Feasibility, "too fast" options                        | **Not in the design**                                                               | §3.11 #6                                                            |

## Part 3 — Backend design

### 3.1 Goals

1. One API that web and mobile use the same way. Both import field schemas from `@fitlens/contracts`.
2. **Resumable:** answers are saved per step on the server, so a user can stop, reinstall or switch device and continue where they left off.
3. **The server decides what's valid.** Every value is range-checked, every combination is checked when finishing, and numbers are computed only by `@fitlens/domain`.
4. **Safe to retry:** finishing twice, or two devices answering at once, never corrupts data.
5. **Microservice-ready:** each module owns its tables, and onboarding only talks to other modules through their services.

### 3.2 Choosing how answers are saved

| Option                                                         | Resume across devices | Drop-off insight | Complexity                                                                                 |
| -------------------------------------------------------------- | --------------------- | ---------------- | ------------------------------------------------------------------------------------------ |
| A. The client keeps state and sends one POST at the end (MVP)  | ✗                     | ✗                | Low                                                                                        |
| B. Save each answer straight into `profiles` / `goals`         | ✓                     | ✓                | Breaks the rule that a profile is complete, and half-finished rows leak into other modules |
| **C. A server-side draft per user, then an atomic "complete"** | ✓                     | ✓                | Medium                                                                                     |

**Choice: C.** Unfinished answers live in a draft that only onboarding reads. The typed tables (`profiles`, `goals`, `body_metrics`, `daily_targets`) are written once, fully validated, when the user finishes. Other modules never see half a profile.

### 3.3 Module boundaries

| Module                 | Owns                                             | Role in onboarding                                                                                |
| ---------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| `onboarding` (**new**) | `onboarding_drafts`                              | Step API, per-step validation, orchestrates completion                                            |
| `users`                | `users`, **`profiles`** (moved here from `plan`) | Who the person is: name, sex, age, body, country, units, timezone, activity, training preferences |
| `plan`                 | `goals`, `daily_targets`                         | What they're aiming for, and the computed targets                                                 |
| `progress`             | `body_metrics`                                   | The first weigh-in                                                                                |

Why `profiles` moves to `users`: every module reads profile facts (timezone, sex, units), but only the plan module should decide targets. This keeps "who you are" separate from "what you aim for", and onboarding becomes a thin orchestrator that can be split out on its own.

Completion calls `UsersService.saveProfile`, `ProgressService.recordWeighIn` and `PlanService.startGoal`. Each one is an **idempotent upsert** with its own key, so a crash halfway through is repaired by retrying. No transaction spans modules (§3.7).

### 3.4 Data model

New and changed tables (Prisma names). All of them cascade on user deletion.

```prisma
enum GoalType        { LOSE_WEIGHT  GAIN_WEIGHT  GAIN_MUSCLE  RECOMPOSITION  HEALTHY_BODY }  // FAT_LOSS→LOSE_WEIGHT, MUSCLE_GAIN→GAIN_MUSCLE
enum UnitSystem      { METRIC  IMPERIAL }
enum OnboardingStep  { NAME  GOAL  ACTIVITY  TRAINING_LOCATION  TRAINING_SCHEDULE  ABOUT_YOU  BODY  WEEKLY_GOAL }

/// One per user while onboarding. Answers are partial and only valid step by step; finishing copies
/// them into typed tables. Deleted on completion. Owned by the onboarding module.
model OnboardingDraft {
  userId        String   @id                     // PK = one draft per user, never addressed by a client-supplied id
  answers       Json     @default("{}")          // { NAME: {...}, GOAL: {...}, ... }, each validated by its step schema
  schemaVersion Int      @default(1)             // bump when the step schemas change; old drafts are migrated or reset
  version       Int      @default(0)             // optimistic concurrency (two devices at once)
  startedAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@map("onboarding_drafts")
}

model Profile {                                  // users module
  userId              String        @id
  preferredName       String        @db.VarChar(40)
  sex                 Sex                         // "sex at birth" for BMR, as the design says
  birthYear           Int                         // from age: see below
  heightCm            Decimal       @db.Decimal(5,1)
  country             String        @db.Char(2)   // ISO 3166-1 alpha-2, upper case
  timezone            String        @db.VarChar(64) // IANA, sent by the client (not a question)
  unitSystem          UnitSystem    @default(METRIC) // display only; storage is always metric
  activityLevel       ActivityLevel
  equipment           Equipment                   // Gym/Home/Anywhere
  trainingDaysPerWeek Int                         // 2–7, CHECK constraint
  sessionMinutes      Int                         // CHECK constraint (range in §3.6)
  onboardedAt         DateTime
  // MVP fields not asked by the new design: kept, defaults per §3.11 #4
  dietType DietType?   experience Experience?   injuries String[] @default([])   medicalFlag Boolean @default(false)
  remindLunch Boolean @default(false)  remindDinner Boolean @default(false)  remindWater Boolean @default(false)
  createdAt DateTime @default(now())   updatedAt DateTime @updatedAt
  @@map("profiles")
}

model Goal {                                     // plan module (changes only)
  type           GoalType
  startWeightKg  Decimal @db.Decimal(5,1)
  targetWeightKg Decimal? @db.Decimal(5,1)      // null for HEALTHY_BODY / RECOMPOSITION (not asked, §3.11 #3)
  weeklyRateKg   Decimal @db.Decimal(4,2)       // signed: −1.00 … +0.50; 0 = maintain
  targetDate     DateTime? @db.Date             // computed from the rate (an output, not an input)
  source         String   @db.VarChar(32)       // "onboarding" | "settings": where the goal came from
  // existing: id, userId, status, startDate, timestamps; @@index([userId, status])
  // + partial unique index: one ACTIVE goal per user (raw SQL in the migration)
}
```

Decisions inside the model:

- **Age → `birthYear`:** the design asks for age, but a stored age goes stale. `birthYear = currentYear − age` keeps the age right as years pass, within a year (fine for BMR). That's less precise than a birth date, so it collects less personal data too.
- **Weight belongs in `body_metrics`**, not the profile. It's a time series, and onboarding writes the first point. `goals.startWeightKg` snapshots it.
- **Metric storage, user-chosen display:** clients convert using one shared function in `@fitlens/domain/units`, so web and mobile round the same way. The API accepts only metric.
- **`Decimal`** for body measurements, so 70.1 doesn't come back as 70.09999.
- **Database constraints** back up the app checks: `CHECK` on ranges, a partial unique index for one active goal, `char(2)` country.

### 3.5 API

All routes need a session (cookie on web, bearer token in the app), are bound to the caller's `userId` on the server, and run under the global rate limit and CSRF origin check.

| Method & path                     | Body                           | Response                             | Notes                                                                                                                                                                                                                                                                                             |
| --------------------------------- | ------------------------------ | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/onboarding`             | —                              | `OnboardingStateDto`                 | `{ status: NOT_STARTED \| IN_PROGRESS \| COMPLETED, version, answers, completedSteps, nextStep }`. Creates nothing.                                                                                                                                                                               |
| `PUT /api/onboarding/steps/:step` | that step's schema + `version` | `OnboardingStateDto`                 | Saves one step. **400** invalid; **409** stale `version` (another device saved first, so the client reloads); **409** already completed. Re-sending the same answer changes nothing.                                                                                                              |
| `POST /api/onboarding/complete`   | `{ version, timezone }`        | `OnboardingResultDto`                | Validates all steps and every cross-field rule, computes the plan, writes profile, weigh-in, goal and targets, then deletes the draft. **Idempotent:** a retry after success returns the same result. **422** with `{ step, field, message }` details when something is missing or contradictory. |
| `GET /api/me` (existing)          | —                              | + `onboarding: { status, nextStep }` | The app's first call after sign-in: route to the next step or to home.                                                                                                                                                                                                                            |

- `:step` is the `OnboardingStep` enum in kebab-case (`training-schedule`). An unknown step → 404.
- Steps can be saved in any order, which supports the back button. `nextStep` is the first unanswered step in design order.
- Contracts (`packages/contracts/src/onboarding.ts`) export one strict Zod schema per step, a `CompleteOnboardingSchema`, the option enums with their order, and the DTOs. Clients render options from these, so nothing is listed twice.

### 3.6 Validation and sanity rules

**Per step (on save, strict schemas: unknown keys rejected):**

| Field                    | Rule                                                                                                                                         |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `preferredName`          | Trimmed, NFC-normalised, inner spaces collapsed; 1–40 characters; letters (any script), spaces, `' - .` only; no control or emoji characters |
| `goal`                   | One of 5                                                                                                                                     |
| `activityLevel`          | One of 5                                                                                                                                     |
| `equipment`              | One of 3                                                                                                                                     |
| `trainingDaysPerWeek`    | Integer 2–7                                                                                                                                  |
| `sessionMinutes`         | Integer 10–180                                                                                                                               |
| `sex`                    | MALE \| FEMALE                                                                                                                               |
| `age`                    | Integer 13–100 (§3.11 #5)                                                                                                                    |
| `country`                | ISO 3166-1 alpha-2, in the shared list                                                                                                       |
| `heightCm`               | 120.0–230.0, one decimal                                                                                                                     |
| `weightKg`               | 30.0–300.0, one decimal                                                                                                                      |
| `goalWeightKg`           | 30.0–300.0, one decimal                                                                                                                      |
| `weeklyRateKg`           | One of the allowed values for the chosen goal (below)                                                                                        |
| `timezone` (at complete) | A valid IANA name (checked with `Intl`), else falls back to the country's main zone                                                          |

**Across fields (on complete; errors name the step to go back to):**

- **Goal vs goal weight:**
  - LOSE_WEIGHT needs a goal weight below the current weight.
  - GAIN_WEIGHT and GAIN_MUSCLE need it above.
  - RECOMPOSITION and HEALTHY_BODY don't ask for it (§3.11 #3), so it's stored as null.
- **A healthy goal weight** (loss and gain goals only): refused if it gives a BMI below 17 ("let's aim for a healthier target"). Goals that would raise BMI above 35 get a warning, not a refusal.
- **Weekly rate options by goal:** loss −0.25/−0.5/−0.75/−1.0; gain +0.25/+0.5; RECOMPOSITION and HEALTHY_BODY are fixed at 0 (screen 9 skipped). The domain caps the result at **1% of body weight per week for loss and 0.5% for gain**, with calorie floors of 1200 (F) and 1500 (M). If a choice gets capped, the result says so (`warnings`).
- **Changed answers:** if the goal changes after the weekly rate was saved and the rate no longer fits, the rate answer is cleared, so `nextStep` points back to screen 9.
- **Never trust client maths:** BMR, TDEE, calories and macros come from `@fitlens/domain` at completion. Client-computed numbers are never accepted.

### 3.7 Completion: retry and crash safety

```
POST /complete
 1. Load draft (userId)        → none + profile exists → return the existing result (idempotent)
 2. Check draft.version == body.version
 3. Validate all steps and cross-field rules (pure, in @fitlens/domain)
 4. plan = domain.planFromRate(...)
 5. users.saveProfile(userId, …)          upsert by userId
 6. progress.recordWeighIn(userId, today) upsert by (userId, date)
 7. plan.startGoal(userId, …, source)     ends any previous ACTIVE goal; one ACTIVE per user (DB index)
 8. plan.setTargets(userId, today, …)     upsert by (userId, effectiveFrom)
 9. delete draft                          last: its absence means "done"
```

Each write is idempotent, so if the process dies between 5 and 9, the client's retry re-runs the same upserts and arrives at the same state. That is why there's no cross-module transaction. If onboarding becomes its own service, each step becomes a call to another service, unchanged. A per-user Redis lock (it falls back to a per-process lock without Redis) stops two simultaneous `complete` calls from racing.

### 3.8 Security and privacy

- **Ownership:** the draft's primary key _is_ the `userId` from the session. There are no client-supplied ids, so one user can't reach another's draft.
- **Strict input:** unknown keys are rejected, the body is capped at 16 KB on these routes, there are enums everywhere, and numbers are bounded and rounded server-side. Name normalisation stops homoglyph tricks and control or zero-width characters.
- **Sensitive data:** sex, age, height and weight are health data:
  - They are never logged (request logs carry no bodies).
  - They are included in the CSV export.
  - They are deleted with the account (cascade).
  - Prompts get only what a feature needs: no name or email (ARCHITECTURE.md §4.7).
- **Abuse:** saving steps falls under the default per-IP limit plus 60 writes/min per user. `complete` is lock-guarded. Drafts untouched for 90 days are removed by the hourly cleanup job.
- **Concurrency:** `version` gives optimistic locking, so two devices can't silently overwrite each other.
- **Errors:** short, kind, user-facing copy in `{ error, details }`, never stack traces. A 422 carries `{ step, field }` so clients can jump back to the right screen.

### 3.9 Domain changes (`@fitlens/domain`)

- `planFromRate({ sex, age, heightCm, weightKg, activity, goal, goalWeightKg, weeklyRateKg })` → BMR, TDEE, kcal, macros, projected target date, applied rate and warnings. It reuses `bmr`, `tdee`, `macrosFor` and `LIMITS`.
- Rules for GAIN_WEIGHT (surplus toward the goal weight) and HEALTHY_BODY (maintenance calories, balanced macros).
- `units`: `cmToFtIn`, `ftInToCm`, `kgToLb`, `lbToKg`, with one rounding rule for both clients.
- `splitFor` supports 7 days (§3.11 #2).
- Each one gets unit tests for every branch and edge value.

### 3.10 Tests

- **Domain:** every formula, every goal type, the rate caps, calorie floors, BMI bounds, unit round-trips.
- **API unit:** step validation, cross-field validation, the draft state machine (`nextStep`, clearing invalid answers).
- **API e2e** (`test/onboarding.e2e.spec.ts`):
  - 401 on every route; 400 per invalid field; 404 unknown step
  - 409 stale version; 409 save after completion; 422 per cross-field rule
  - resume across "devices" (two sessions, one user)
  - `complete` twice → same result; a crash simulated between writes and repaired by retry
  - another user's data never visible
  - account deletion removes the draft
  - `GET /me` reports the onboarding status

### 3.11 Decisions

| #   | Question                                               | Decision (2026-10-02)                                                                                                                                                                                                                           |
| --- | ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | One goal or several?                                   | **One goal.** One ACTIVE goal per user.                                                                                                                                                                                                         |
| 2   | 7 training days                                        | _Default, unless changed:_ support 7 (a 7-day split with active-recovery days).                                                                                                                                                                 |
| 3   | Goal weight for Recomposition / Healthy body           | _Default, unless changed:_ skip goal weight and the weekly-goal screen for both (maintenance).                                                                                                                                                  |
| 4   | Diet type, experience and injuries are no longer asked | **Defaults, ask later.** Nullable columns with safe defaults: diet unknown (no veg filtering), experience BEGINNER, no injuries. Collected later in Settings.                                                                                   |
| 5   | Safety (pregnant / medical / under-18)                 | **Keep as designed:** no medical question and no age gate. Calorie floors (1200 F / 1500 M) and the rate caps are the only guards. `age` is still range-checked for sane maths (13–100). Known risk: a pregnant user can get a calorie deficit. |
| 6   | After screen 9                                         | **Not designed yet.** `complete` returns the full plan (kcal, macros, projected date) so any next screen can use it. The client decides where to go.                                                                                            |
| 7   | Activity subtitles                                     | _Default, unless changed:_ Mostly sitting – under 5k steps · Lightly active – 5–7.5k steps · Moderately active – 7.5–10k steps · Very active – over 10k steps or on your feet all day · Athlete – physical job plus daily training.             |
