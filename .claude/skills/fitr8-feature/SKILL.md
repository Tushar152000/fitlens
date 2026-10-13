---
name: fitr8-feature
description: Build or change a FITR8 feature end to end (contract → domain rule → Nest module → e2e test → web/mobile UI) following docs/ARCHITECTURE.md. Use for any new endpoint, table, screen, or change to business rules in this monorepo.
---

# FITR8 feature workflow

Read `docs/ARCHITECTURE.md` first; it is binding. UI work also follows `docs/DESIGN.md` exactly.
Use Node 22 (`nvm use`) and pnpm (`corepack enable`). Run everything from the repo root.

## 1. Decide where each piece lives

| Piece                                 | Location                                                                               |
| ------------------------------------- | -------------------------------------------------------------------------------------- |
| Request schema + inferred type        | `packages/contracts/src/requests.ts` (or a new file exported from `index.ts`)          |
| Pure rule / calculation               | `packages/domain/src/<area>/` + `*.test.ts` beside it                                  |
| Table / column                        | `packages/db/prisma/schema.prisma` → `pnpm db:migrate --name <change>`                 |
| Use case (orchestration, persistence) | `apps/api/src/modules/<context>/<context>.service.ts`                                  |
| HTTP route                            | `apps/api/src/modules/<context>/<context>.controller.ts`                               |
| Background work                       | `<context>.job.ts`, registered with `JobQueue.register` in the module's `onModuleInit` |
| Screen                                | `apps/web/src/app/...` and/or `apps/mobile/src/app/...`                                |

Pick the owning bounded context from the table in ARCHITECTURE.md §3.2. A module only writes its own tables; to read another context's data, inject that module's exported service (add it to `exports` and import the module).

## 2. Backend pattern (copy `modules/water`)

```ts
// controller: transport only
@Controller("water")
export class WaterController {
  constructor(
    private readonly water: WaterService,
    private readonly users: UsersService,
  ) {}

  @Post()
  async add(@UserId() userId: string, @ZodBody(WaterAddSchema) { ml }: WaterAddInput) {
    const date = await this.users.today(userId);
    await this.water.add(userId, date, ml);
    return this.water.getDay(userId, date);
  }
}
```

- Every route is authenticated by the global guard; use `@Public()` only for health/OAuth.
- Filter every query by `userId`. Missing or foreign rows → `throw notFound("Meal")` (404, never 403 — don't leak existence).
- Expected failures: `throw new AppError(status, "Short, kind, user-facing message", details?)`.
- Config: add the variable to `apps/api/src/config/env.ts` and `.env.example`; inject with `@InjectEnv()`. Never read `process.env` elsewhere.
- Imports inside apps/api and packages use `.js` extensions (NodeNext ESM).
- Register a new module in `apps/api/src/app.module.ts`.

## 3. Tests (required)

- Domain: `packages/domain/src/**/<name>.test.ts` — every branch and edge value.
- API e2e: `apps/api/test/<context>.e2e.spec.ts` using `createTestApp()` from `test/support/app.ts`:
  ```ts
  const { agent, userId } = await t.signIn();
  await agent.post("/api/onboarding").send(onboardingPayload()).expect(201);
  await agent.post("/api/water").send({ ml: 250 }).expect(201);
  ```
  Cover: 401 without session, 400 invalid body, 404 on another user's id, happy-path response shape.
- Unit specs for services with real branching: `apps/api/src/**/*.spec.ts`.

## 4. Clients

- Web server components: `serverApi<T>("/path")` from `apps/web/src/lib/server/api.ts`. Browser code: same-origin `/api/...` via `apps/web/src/lib/client/api.ts`.
- Mobile: `api<T>("/api/path")` from `apps/mobile/src/lib/api.ts` (+ TanStack Query hooks in `src/lib/queries.ts`).
- Import request types from `@fitr8/contracts`; never redeclare them.

## 5. Done means

```bash
pnpm check          # lint + typecheck + test for every workspace
pnpm format         # prettier
```

All green, migration committed, `.env.example` updated, and the checklist in ARCHITECTURE.md §7 satisfied.
