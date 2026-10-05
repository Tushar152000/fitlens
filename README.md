# FITR8 — AI fitness coach

Snap a photo of your meal → AI detects foods and portions → you confirm → calories and macros are logged against targets computed from your goal. A workout engine plans calorie-aware sessions, weekly check-ins adapt the plan, and an AI coach (a Claude agent with tools over your own data) answers questions and logs water, weigh-ins and meal drafts for you.

**Stack:** TypeScript everywhere · pnpm workspaces + Turborepo · **NestJS 12** API (the only backend) · **Next.js 16** PWA · **Expo 57** app · PostgreSQL + Prisma 7 · Redis + BullMQ · S3-compatible storage · Claude (structured extraction + agent loop) · Vitest + Supertest · GitHub Actions · Docker.

```
             ┌──────────────┐        ┌──────────────┐
  browser ──►│  apps/web    │  /api  │              │──► PostgreSQL
             │  Next.js PWA │───────►│  apps/api    │──► Redis (jobs, locks)
             └──────────────┘ proxy  │  NestJS      │──► S3 / R2 / MinIO
  phone ────────────────────────────►│  one service │──► Claude
             apps/mobile (Expo)      └──────────────┘
                                        ▲ same image, APP_ROLE=worker
                                        └── queue consumers
```

Read **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** before changing code — it defines module boundaries, layering, error handling, testing and how a module becomes its own microservice. UI follows **[docs/DESIGN.md](docs/DESIGN.md)**.

## Repository

```
apps/
  api/          NestJS service — HTTP API (main.ts) and queue worker (worker.ts), one image
    src/config      validated env (env.ts is the reference for every variable)
    src/common      auth guard + decorators, error filter, zod pipe, signing
    src/infra       Prisma, Redis, BullMQ JobQueue, S3 storage
    src/modules     bounded contexts: auth users plan meals foods water workouts progress coach ai health
    test/           e2e specs (real app + Postgres, mock AI)
  web/          Next.js PWA — UI only; proxies /api to the API at request time
  mobile/       Expo app (iOS/Android/web) — UI only; EAS builds and OTA updates
packages/
  domain/       pure rules: nutrition, training engine, dates, formatting, barcode/label maths (+ tests)
  contracts/    zod request schemas, AI output schemas, coach stream events — shared by API and clients
  db/           Prisma schema, migrations, seed, generated client (API only)
  tsconfig/     shared compiler settings
docs/           ARCHITECTURE.md · DESIGN.md · DEPLOY.md
.claude/skills  fitr8-feature, fitr8-coach-tool — step-by-step workflows for future development
```

## Getting started

Prereqs: Node 22 (`nvm use` reads `.nvmrc`), Docker, and pnpm (`corepack enable`).

```bash
pnpm install
cp .env.example .env          # set AUTH_SECRET: openssl rand -base64 33
pnpm infra:up                 # Postgres :5432, Redis :6379, MinIO :9000 (console :9001)
pnpm db:migrate               # apply migrations
pnpm db:seed                  # starter Indian foods + exercise library
pnpm dev                      # API http://localhost:4000 · web http://localhost:3000
pnpm dev:mobile               # Expo (set EXPO_PUBLIC_API_URL in apps/mobile/.env for a phone)
```

- **No Google keys needed locally:** with `AUTH_DEV_LOGIN=true` the login screen offers an email-only dev sign-in (refused in production).
- **No AI key needed:** `AI_PROVIDER=mock` returns canned meal detections and a scripted coach so every flow works. Set `AI_PROVIDER=anthropic` + `ANTHROPIC_API_KEY` for real detection and coaching.
- **Redis is optional:** without `REDIS_URL`, meal analysis runs inline in the request. With it, jobs go to BullMQ and the API process (APP_ROLE=all) or a separate worker consumes them.
- Port clash? Compose ports are overridable: `REDIS_PORT=6380 pnpm infra:up` (then update `REDIS_URL`).
- Google sign-in: OAuth client with redirect URI `http://localhost:3000/api/auth/callback/google`; fill `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`.

Run the whole stack in containers instead: `docker compose --profile app up --build`.

## Commands

| Command                                           | What it does                                                         |
| ------------------------------------------------- | -------------------------------------------------------------------- |
| `pnpm dev` / `dev:api` / `dev:web` / `dev:mobile` | Run apps in watch mode (packages build first)                        |
| `pnpm check`                                      | Lint + typecheck + test for every workspace — what CI runs           |
| `pnpm test`                                       | Unit + e2e tests (e2e needs Postgres; creates `fitlens_test` itself) |
| `pnpm lint` / `typecheck` / `build`               | One task across the monorepo (Turborepo caches results)              |
| `pnpm format` / `format:check`                    | Prettier                                                             |
| `pnpm db:migrate -- --name <change>`              | Create + apply a migration after editing `schema.prisma`             |
| `pnpm db:seed` / `db:studio` / `db:deploy`        | Seed · Prisma Studio · apply migrations (prod)                       |
| `pnpm infra:up` / `infra:down`                    | Local Postgres, Redis, MinIO                                         |

Filter any task to one workspace: `pnpm turbo run test --filter=@fitr8/api`.

## Backend at a glance

- **One service, two roles:** `node dist/main.js` (HTTP, `APP_ROLE=api`) and `node dist/worker.js` (queues, `APP_ROLE=worker`) from the same image; `APP_ROLE=all` for dev.
- **Modular monolith:** each module owns its tables and exposes one service; modules talk only through those services — so any module can be extracted into its own service later (ARCHITECTURE.md §6).
- **Auth:** Google OIDC in the API; opaque DB sessions (httpOnly cookie on web, bearer token in the app via a PKCE hand-off). Existing Auth.js sessions stay valid.
- **Reliability:** validated config, global error shape `{ error, details }`, request ids + structured logs, helmet, throttling + per-user AI quotas, liveness/readiness probes, graceful shutdown, idempotent retried jobs.
- **Deterministic core:** targets, training plans and nutrition maths are pure tested functions in `@fitr8/domain`. The AI only identifies foods/portions (schema-validated, user-confirmed) and talks.

### The AI coach (agent loop)

`POST /api/coach/chat` streams server-sent events. A manual streaming tool-use loop (`apps/api/src/modules/coach/agent`) lets Claude call typed tools — today's overview, history, progress, today's workout, food search, log water, log weigh-in, draft a meal — each a thin call into the same services the screens use, bound to the signed-in user. Context is managed with a frozen cached system prompt, an append-only transcript (safe for prompt caching and preserved thinking), server-side compaction for long threads, an iteration cap that ends with a text answer, per-conversation locking, daily limits and per-call usage accounting.

## API (all under `/api`, sign-in required unless noted)

| Area            | Routes                                                                                                                                                                                                                                                             |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Health (public) | `GET /health` (readiness: DB + Redis) · `GET /health/live`                                                                                                                                                                                                         |
| Auth (public)   | `GET /auth/google` · `GET /auth/callback/google` · `POST /auth/signout` · `GET /auth/providers` · `POST /auth/dev` (dev only) · `GET /mobile/start` · `POST /mobile/token` · `POST /mobile/signout`                                                                |
| Account         | `GET /me` · `DELETE /account` · `GET /export` (CSV) · `PATCH /profile/reminders` · `PATCH /profile/name`                                                                                                                                                           |
| Plan            | `POST /onboarding` · `GET /targets` · `GET /plan` · `POST /goal/option`                                                                                                                                                                                            |
| Meals           | `POST /meals/upload-url` · `POST /meals` · `GET /meals?date=` · `GET/PUT/DELETE /meals/:id` · `POST /meals/:id/recheck` · `POST /meals/parse-items` · `POST /meals/log-items` · `POST /meals/quick-add` · `POST /meals/relog` · `GET /meals/usuals` · `GET /usage` |
| Foods           | `GET /foods?q=` · `GET /foods/barcode/:code` · `POST /foods/label` · `GET /foods/label/:id` · `POST /foods/label/:id/save`                                                                                                                                         |
| Water           | `GET /water` · `POST /water` · `DELETE /water/:id`                                                                                                                                                                                                                 |
| Workouts        | `GET /workouts/today?energy=` · `POST /workouts/logs` · `POST /workouts/generate`                                                                                                                                                                                  |
| Progress        | `GET/POST /checkins` · `GET /progress` · `GET /history?days=7\|30` · `GET /dashboard?date=`                                                                                                                                                                        |
| Coach           | `POST /coach/chat` (SSE) · `GET /coach/conversations` · `GET/DELETE /coach/conversations/:id`                                                                                                                                                                      |

Request schemas: `packages/contracts`. Errors: `{ "error": "message", "details"?: … }`.

## Testing

- `packages/domain`: unit tests for every rule.
- `apps/api`: unit specs (`src/**/*.spec.ts`, e.g. the agent loop against a scripted model) and e2e specs (`test/*.e2e.spec.ts`) that boot the real app against a migrated, seeded `fitlens_test` database with mock AI — every route is covered for auth, validation, ownership and response shape.
- `apps/web`: unit tests for client-side helpers.

## CI/CD

- **CI** (`.github/workflows/ci.yml`, every PR and push to main): install → prettier check → Prisma validate → `turbo run lint typecheck test build` with a Postgres service → Docker image builds for api and web.
- **Deploy** (`deploy.yml`, after CI passes on main): push `ghcr.io/<repo>/api` and `/web` images (sha + latest) → `prisma migrate deploy` against production → trigger deploy hooks. See [docs/DEPLOY.md](docs/DEPLOY.md).
- **Mobile** (`eas-update.yml`): OTA update to the `preview` channel when the app or contracts change.
- Dependabot keeps npm and Actions dependencies current.

> Food values in `packages/db/prisma/seed.ts` are approximate placeholders. Replace them with IFCT 2017 / INDB data before launch. FITR8 is not medical advice.
