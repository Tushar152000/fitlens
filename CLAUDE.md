@AGENTS.md

# FITR8

pnpm + Turborepo monorepo: `apps/api` (NestJS, the only backend), `apps/web` (Next.js PWA, pure API client), `apps/mobile` (Expo), `packages/{domain,contracts,db,tsconfig}`.

## Standards

- **Architecture and engineering rules:** `docs/ARCHITECTURE.md` — binding for every change (module boundaries, layering, errors, testing, the coach agent loop).
- **UI:** `docs/DESIGN.md` (tokens, components, screens, states). Match it exactly.
- **Workflows:** use the `fitr8-feature` skill for any feature/endpoint/table/screen, and `fitr8-coach-tool` for the AI coach.

## Commands (Node 22 — `nvm use`; pnpm via corepack)

Local setup and troubleshooting: `docs/DEVELOPMENT.md`.

```bash
pnpm bootstrap       # set up / repair local env (.env, Docker, migrations, seed)
pnpm start:all       # everything: services, api :4000 + web :3000, emulator, app (pnpm stop:all)
pnpm dev             # api :4000 + web :3000 only
pnpm db:migrate      # apply/create migrations (dev)
pnpm check           # lint + typecheck + test, every workspace (CI runs the same)
pnpm format          # prettier
```

Done means `pnpm check` is green and new routes have e2e tests.
