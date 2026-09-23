# FitLens — AI fitness coach

Snap a photo of your meal → AI detects foods and portions → you confirm → calories and macros are logged against targets computed from your goal. Weekly check-ins adapt the plan.

**Stack:** Next.js 16 (App Router, TypeScript, Tailwind v4) · PostgreSQL + Prisma 7 · Auth.js v5 · S3-compatible storage · BullMQ/Redis · pluggable vision LLM · Vitest.

## Architecture

```
Browser ──► Next.js (UI + /api route handlers) ──► PostgreSQL (Prisma)
                 │            │
                 │            └──► S3 / MinIO (meal photos, signed URLs)
                 └──► Redis queue ──► worker ──► Vision LLM ──► PostgreSQL
```

- Targets come from deterministic, unit-tested formulas (`src/lib/nutrition`), not the LLM.
- The AI only identifies foods and portions; calories come from the food database.
- A `MealLog` doubles as the AI job: `PENDING → ANALYZING → READY → CONFIRMED`.
- Without `REDIS_URL`, meals are analysed inline in the API request.
- `AI_PROVIDER=mock` returns fake detections so you can build the UI with no API key.

## Getting started

Prereqs: Node 20.9+, Docker Desktop.

```bash
npm install                 # also runs prisma generate
cp .env.example .env        # then set AUTH_SECRET: npx auth secret
npm run db:up               # Postgres, Redis, MinIO (+ bucket)
npm run db:migrate -- --name init
npm run db:seed             # starter Indian foods + exercises
npm run dev                 # http://localhost:3000
npm run worker              # in a second terminal (only if REDIS_URL is set)
```

Google sign-in: create OAuth credentials, add redirect URI `http://localhost:3000/api/auth/callback/google`, and fill `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`.

MinIO console: http://localhost:9001 (fitlens / fitlens-secret).

## Scripts

| Script                                         | What it does         |
| ---------------------------------------------- | -------------------- |
| `npm run dev`                                  | Dev server           |
| `npm run worker`                               | Background AI worker |
| `npm test`                                     | Unit tests (Vitest)  |
| `npm run typecheck` / `lint` / `format`        | Quality checks       |
| `npm run db:migrate` / `db:seed` / `db:studio` | Database             |

## API (all require sign-in except health)

| Method             | Path                         | Purpose                                                    |
| ------------------ | ---------------------------- | ---------------------------------------------------------- |
| GET                | `/api/health`                | DB health check                                            |
| POST               | `/api/onboarding`            | Profile + first weigh-in + goal → BMI, body fat, targets   |
| GET                | `/api/targets`               | Current daily kcal and macros                              |
| POST               | `/api/meals/upload-url`      | Signed URL to upload a meal photo                          |
| POST               | `/api/meals`                 | Create a meal from `photoKey` or `text`; triggers analysis |
| GET                | `/api/meals?date=YYYY-MM-DD` | List meals                                                 |
| GET / PUT / DELETE | `/api/meals/:id`             | Poll status · confirm edited items · delete                |
| GET                | `/api/dashboard?date=`       | Intake vs targets for a day                                |
| GET / POST         | `/api/checkins`              | Weigh-ins and measurements                                 |
| POST               | `/api/workouts/generate`     | 501, lands in week 4                                       |

## Project layout

```
prisma/            schema.prisma, seed.ts, migrations
src/auth.ts        Auth.js config (Google + optional Resend email)
src/app/           pages and /api route handlers
src/lib/nutrition  BMI, Navy body fat, BMR/TDEE, goal planning, macros (+ tests)
src/lib/ai         provider interface, Anthropic + mock providers, prompts, schemas
src/lib/services   targets, meal analysis/confirmation, dashboard
src/lib/storage    S3 signed URLs
src/lib/queue      BullMQ queue
worker/            background worker
```

## Roadmap

Following the PRD: onboarding UI → photo logging UI → workout plans → weekly adaptive check-ins → beta launch.

> Food values in `prisma/seed.ts` are approximate placeholders. Replace them with IFCT 2017 / INDB data before launch. FitLens is not medical advice.
