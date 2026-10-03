# FitLens — AI fitness coach

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
.claude/skills  fitlens-feature, fitlens-coach-tool — step-by-step workflows for future development
```

## Getting started

Prereqs: Node 22 (`nvm use`), Docker, and for mobile Expo Go or an Android emulator. **Full guide: [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md)** (setup, daily commands, phone and emulator, Google sign-in locally, troubleshooting).

```bash
nvm use && corepack enable && pnpm install
pnpm bootstrap      # once: .env, Docker services, migrations, seed (safe to re-run)
pnpm start:all      # API + web + Android emulator + app, in one terminal
pnpm stop:all       # stop it all (data kept)
```

Locally nothing needs an account: "Sign in with email (dev)" on web and app, mock AI, MinIO for photos. Web runs at http://localhost:3000, the API at :4000.

### Environments

`APP_ENV` says where the API runs; `NODE_ENV` only says how it's built. Templates: `.env.example` (local) and `.env.production.example` (deployed).

| `APP_ENV`               | Used by                               | Dev sign-in | Google   | `PUBLIC_URL` | Reads `.env` |
| ----------------------- | ------------------------------------- | ----------- | -------- | ------------ | ------------ |
| `local`                 | `pnpm dev`, the compose `app` profile | on          | optional | http ok      | yes          |
| `test`                  | e2e tests (set automatically)         | on          | faked    | http ok      | no           |
| `staging`, `production` | deployments                           | refused     | required | https only   | no           |

Unset, it follows `NODE_ENV` and fails safe: a production build without `APP_ENV` gets production rules.

## Commands

| Command                                           | What it does                                                         |
| ------------------------------------------------- | -------------------------------------------------------------------- |
| `pnpm bootstrap`                                  | Set up or repair the local environment (idempotent)                  |
| `pnpm start:all` / `stop:all`                     | Start / stop the whole local stack incl. emulator and app            |
| `pnpm emulator`                                   | Create (once) and boot the "fitlens" Android emulator                |
| `pnpm dev` / `dev:api` / `dev:web` / `dev:mobile` | Free the app's fixed ports, then run it in watch mode                |
| `pnpm check`                                      | Lint + typecheck + test for every workspace + repo scripts (= CI)    |
| `pnpm test`                                       | Unit + e2e tests (e2e needs Postgres; creates `fitlens_test` itself) |
| `pnpm lint` / `typecheck` / `build`               | One task across the monorepo (Turborepo caches results)              |
| `pnpm format` / `format:check`                    | Prettier                                                             |
| `pnpm db:migrate -- --name <change>`              | Create + apply a migration after editing `schema.prisma`             |
| `pnpm db:seed` / `db:studio` / `db:deploy`        | Seed · Prisma Studio · apply migrations (prod)                       |
| `pnpm infra:up` / `infra:down`                    | Local Postgres, Redis, MinIO                                         |

Filter any task to one workspace: `pnpm turbo run test --filter=@fitlens/api`.

## Backend at a glance

- **One service, two roles:** `node dist/main.js` (HTTP, `APP_ROLE=api`) and `node dist/worker.js` (queues, `APP_ROLE=worker`) from the same image; `APP_ROLE=all` for dev.
- **Modular monolith:** each module owns its tables and exposes one service; modules talk only through those services — so any module can be extracted into its own service later (ARCHITECTURE.md §6).
- **Auth:** Google sign-in (OIDC + PKCE + nonce, ID token verified) in the API; hashed, sliding, revocable DB sessions shared by web (`__Host-` httpOnly cookie) and app (bearer token via a one-time PKCE code). Device list, sign out everywhere, CSRF origin check, sign-in rate limits, audit log (ARCHITECTURE.md §3.6).
- **Reliability:** validated config, global error shape `{ error, details }`, request ids + structured logs, helmet, throttling + per-user AI quotas, liveness/readiness probes, graceful shutdown, idempotent retried jobs.
- **Deterministic core:** targets, training plans and nutrition maths are pure tested functions in `@fitlens/domain`. The AI only identifies foods/portions (schema-validated, user-confirmed) and talks.

### The AI coach (agent loop)

`POST /api/coach/chat` streams server-sent events. A manual streaming tool-use loop (`apps/api/src/modules/coach/agent`) lets Claude call typed tools — today's overview, history, progress, today's workout, food search, log water, log weigh-in, draft a meal — each a thin call into the same services the screens use, bound to the signed-in user. Context is managed with a frozen cached system prompt, an append-only transcript (safe for prompt caching and preserved thinking), server-side compaction for long threads, an iteration cap that ends with a text answer, per-conversation locking, daily limits and per-call usage accounting.

## API (all under `/api`, sign-in required unless noted)

| Area            | Routes                                                                                                                                                                                                                                                             |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Health (public) | `GET /health` (readiness: DB + Redis) · `GET /health/live`                                                                                                                                                                                                         |
| Auth (public)   | `GET /auth/providers` · `GET /auth/google` · `GET /auth/mobile/start` · `GET /auth/callback/google` · `POST /auth/mobile/token` · `POST /auth/signout` · `POST /auth/dev` (dev only)                                                                               |
| Sessions        | `GET /auth/sessions` · `DELETE /auth/sessions/:id` · `POST /auth/signout-all`                                                                                                                                                                                      |
| Account         | `GET /me` · `DELETE /account` · `GET /export` (CSV) · `PATCH /profile/reminders`                                                                                                                                                                                   |
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

> Food values in `packages/db/prisma/seed.ts` are approximate placeholders. Replace them with IFCT 2017 / INDB data before launch. FitLens is not medical advice.
