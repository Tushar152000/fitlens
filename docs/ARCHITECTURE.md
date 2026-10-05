# FITR8 architecture and engineering standards

This is the contract for every change, human or AI. When code and this file disagree, fix one of them in the same PR.

## 1. System shape

```
             ┌──────────────┐        ┌──────────────┐
  browser ──►│  apps/web    │  /api  │              │──► PostgreSQL (Prisma)
             │  Next.js PWA │───────►│  apps/api    │──► Redis (BullMQ jobs, locks)
             └──────────────┘ proxy  │  NestJS      │──► S3 / R2 / MinIO (photos)
  phone ────────────────────────────►│  one service │──► Claude (extraction + coach agent)
             apps/mobile (Expo)      └──────────────┘
                                        ▲ same image, APP_ROLE=worker
                                        └── queue consumers (meal analysis …)
```

- **One backend.** `apps/api` is the only process that talks to the database, storage, queue or an LLM. Web and mobile are clients of the same HTTP API (`/api/*`).
- **Web is a pure client.** Next.js server components call the API with the user's cookie forwarded (`apps/web/src/lib/server/api.ts`); the browser calls `/api/*` on its own origin, which Next rewrites to the API. The web app holds no secrets and no business rules.
- **Two runtime roles, one codebase.** `dist/main.js` serves HTTP (`APP_ROLE=api`), `dist/worker.js` consumes queues (`APP_ROLE=worker`), `APP_ROLE=all` does both for local dev and small deployments. Scale them separately.

## 2. Repository layout

| Path                 | What lives there                                                                                                                 | May depend on                                    |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| `apps/api`           | NestJS service: HTTP adapters, application services, infrastructure adapters, jobs, the coach agent                              | `@fitr8/domain`, `@fitr8/contracts`, `@fitr8/db` |
| `apps/web`           | Next.js 16 PWA (UI only)                                                                                                         | `@fitr8/domain` (formatting), `@fitr8/contracts` |
| `apps/mobile`        | Expo app (UI only)                                                                                                               | `@fitr8/contracts`                               |
| `packages/domain`    | Pure business rules: nutrition, training engine, dates, formatting, barcode/label maths. No I/O, no framework. 100% unit-tested. | `zod` only                                       |
| `packages/contracts` | Zod request schemas, AI output schemas, coach stream events, shared DTO types                                                    | `zod`, `@fitr8/domain` (types only)              |
| `packages/db`        | Prisma schema, migrations, seed, generated client                                                                                | `@fitr8/domain` (seed only)                      |
| `packages/tsconfig`  | Shared compiler settings                                                                                                         | —                                                |

Dependency rules are one-way: `apps → packages`, `db → domain`, never `packages → apps`, never `web/mobile → db`.

## 3. Backend design (apps/api)

### 3.1 Layers inside a module

```
modules/<context>/
  <context>.module.ts       wiring only
  <context>.controller.ts   HTTP adapter: route, auth (@UserId), validation (@ZodBody), status codes. No rules, no Prisma.
  <context>.service.ts      application service: orchestrates domain rules + persistence. Throws AppError.
  <context>.job.ts          (optional) queue handler, registered with JobQueue on module init
  *.spec.ts                 unit tests next to the code
test/<context>.e2e.spec.ts  HTTP-level tests against the real app and a real test database
```

- **Controllers are thin.** Parse → call one service method → return. If a controller grows an `if` about business state, move it into the service.
- **Services own rules and persistence.** They inject `PrismaService` and other modules' _exported services_. Pure calculations live in `@fitr8/domain` and are imported, never re-implemented.
- **Infrastructure behind ports.** Storage (`StorageService`), queue (`JobQueue`), model access (`FOOD_EXTRACTOR`, `ANTHROPIC`) are injected. Swapping S3 for R2, Redis for SQS, or Claude for a mock never touches feature code.
- **Errors.** Throw `AppError(status, message, details?)` (framework-free). `AllExceptionsFilter` renders `{ error, details }`, turns `ZodError` into 400, and hides internals behind a 500. Messages are user-facing copy: short, kind, actionable.
- **Validation at the edge.** Every body/query goes through a schema from `@fitr8/contracts` (`@ZodBody(Schema)`). Services receive typed, trusted input.
- **Auth is global.** `AuthGuard` requires a session on every route; opt out with `@Public()` (health, OAuth). Get the caller with `@UserId()`. Every query that touches user data filters by `userId` — ownership checks are not optional.

### 3.2 Bounded contexts (modules)

| Module     | Owns tables                                    | Routes                                                              |
| ---------- | ---------------------------------------------- | ------------------------------------------------------------------- |
| `auth`     | sessions, accounts, verification_tokens        | `/auth/*`, `/mobile/*`                                              |
| `users`    | users                                          | `/me`, `/account`, `/export`, `/profile/reminders`, `/profile/name` |
| `plan`     | profiles, goals, daily_targets                 | `/onboarding`, `/targets`, `/plan`, `/goal/option`                  |
| `meals`    | meal_logs, meal_items, ai_calls                | `/meals/*`, `/usage`                                                |
| `foods`    | foods, food_units, barcode_misses, label_scans | `/foods/*`                                                          |
| `water`    | water_logs                                     | `/water/*`                                                          |
| `workouts` | exercises, workout_plans, workout_logs         | `/workouts/*`                                                       |
| `progress` | body_metrics, checkins                         | `/checkins`, `/progress`, `/history`, `/dashboard`                  |
| `coach`    | coach_conversations, coach_messages            | `/coach/*`                                                          |
| `ai`       | — (model access)                               | —                                                                   |
| `health`   | —                                              | `/health`, `/health/live`                                           |

**Rule:** a module writes only its own tables. Reading another context's data goes through that module's exported service. This is what makes extraction into a separate service a mechanical change (see §6).

### 3.3 Async work

`JobQueue.enqueue(queue, data)` → BullMQ when `REDIS_URL` is set, inline otherwise. Handlers are **idempotent** (a job may run twice), keep state on the row they process (`MealLog.status: PENDING → ANALYZING → READY | FAILED`), and never assume the HTTP request is still alive.

### 3.4 The coach agent (Claude agent loop)

`modules/coach` runs a manual, streaming tool-use loop (`agent/agent-loop.ts`) over tools defined in `coach/tools/*`:

- **Tools are the only way the model touches data.** Each tool is a Zod-typed function that calls an application service with the signed-in user's id bound server-side; the model can never choose whose data it sees. Writes are small and reversible (log water, log a weigh-in, draft a meal for the user to confirm) — the model never confirms a meal or changes targets.
- **Numbers come from tools, not the model.** The system prompt forbids inventing calories or macros.
- **Append-only transcript.** Assistant turns are stored verbatim (`CoachMessage.content`, including thinking and compaction blocks) and replayed unchanged — required for prompt caching and preserved thinking. Never edit or delete past turns; dynamic context (local time) goes in the new user turn.
- **Context management.** Frozen system prompt + tools with a cache breakpoint, automatic caching of the conversation tail, server-side compaction for long threads, and a per-step persistence rule: an assistant turn with `tool_use` is saved only together with its `tool_result`s, so a crash or disconnect can never leave an invalid transcript.
- **Limits.** Max iterations per turn, per-user daily message cap, one active turn per conversation (Redis lock), client disconnect aborts the model stream.
- **Observability.** Every model request writes an `AiCall` row (type, model, tokens incl. cache reads, latency, success).

### 3.5 Cross-cutting

- **Config:** all env vars are declared and validated in `src/config/env.ts`; the process refuses to boot on invalid config. Read config only via `@InjectEnv()`.
- **Logging:** structured JSON (pino) with a request id (`x-request-id` in and out); cookies and auth headers are never logged.
- **Security:** helmet, httpOnly SameSite=Lax session cookie, PKCE hand-off for the app, signed OAuth state bound to a nonce cookie, same-site-only redirects, per-IP throttling plus per-user AI quotas, signed short-lived storage URLs, per-user storage keys verified server-side.
- **Health:** `/api/health/live` (process up) for liveness, `/api/health` (DB + Redis) for readiness.
- **Shutdown:** SIGTERM closes the HTTP server, lets queue workers finish in-flight jobs, then disconnects Prisma/Redis.

## 4. Design principles (apply everywhere)

1. **SOLID, pragmatically.** One reason to change per class (controller = transport, service = use case, domain = rule). Depend on injected abstractions for anything with I/O. Extend by adding a module or tool, not by editing a switch.
2. **Deterministic core, probabilistic edge.** Targets, training plans, adjustments and nutrition maths are pure, tested functions in `@fitr8/domain`. LLMs only _perceive_ (what food, how much) and _talk_ (coach). Their output is always schema-validated and shown to the user for confirmation.
3. **One source of truth per fact.** Schemas in `contracts`, rules in `domain`, data in one module's tables. No copy-pasted types between apps — import them.
4. **Explicit over clever.** Plain functions and classes, descriptive names, no metaprogramming beyond Nest's DI. A new developer should find any route in two hops: `module → controller → service`.
5. **Fail loudly at boundaries, gracefully inside.** Validate input/config strictly; inside, a missing photo URL or a storage outage degrades one field, never a whole screen.
6. **Idempotent and retry-safe.** Jobs, webhooks and client retries must be safe to repeat (upserts, unique keys, status machines).
7. **Privacy by default.** Least data to the model (no email/name in prompts), per-user ownership on every query, user deletion cascades.
8. **Design contract.** UI follows `docs/DESIGN.md` exactly (tokens, components, copy tone: kind, never shaming).

## 5. Testing strategy

| Layer         | Tool                                                        | Where                              | Must cover                                                                    |
| ------------- | ----------------------------------------------------------- | ---------------------------------- | ----------------------------------------------------------------------------- |
| Domain rules  | Vitest                                                      | `packages/domain/src/**/*.test.ts` | every formula and branch, edge values                                         |
| API services  | Vitest + fakes                                              | `apps/api/src/**/*.spec.ts`        | branching logic, agent loop, auth crypto                                      |
| API over HTTP | Vitest + Supertest, real Postgres (`fitlens_test`), mock AI | `apps/api/test/*.e2e.spec.ts`      | every route: auth required, validation 400s, ownership 404s, happy path shape |
| Web           | Vitest                                                      | `apps/web/src/**/*.test.ts`        | client-side state helpers                                                     |

`pnpm test` runs everything through Turborepo; CI runs the same command with a Postgres service. A feature is not done until its route has an e2e test.

## 6. Extracting a microservice (when load demands it)

The modular monolith is designed so a module can leave without a rewrite:

1. The module already owns its tables and exposes one service class — make that the new service's API (HTTP or gRPC/NATS via `@nestjs/microservices`).
2. Replace the in-process service injection in consumers with a client implementing the same TypeScript interface (same method names and DTOs from `contracts`).
3. Move its tables to their own schema/database; other modules never joined across them, so nothing else changes.
4. Background work already runs through queues; point the new service at the same queue names.

Good first candidates: `meals` analysis workers (CPU/latency-heavy AI calls) and `coach` (long-lived streaming connections).

## 7. Change checklist

- [ ] Input schema added/updated in `packages/contracts`
- [ ] Rules in `packages/domain` with unit tests, or in a service with a spec
- [ ] Controller thin; route covered by an e2e test (401, 400, 404, happy path)
- [ ] Migration created with `pnpm db:migrate --name <change>` and committed
- [ ] New env vars declared in `apps/api/src/config/env.ts` and `.env.example`
- [ ] `pnpm check` (lint + typecheck + test) green
- [ ] UI matches `docs/DESIGN.md`
