# Infra, CI, deploy, local

## CI `.github/workflows/ci.yml`

Every PR + push to main. Job `check` (Postgres 17): frozen install → `format:check` → `prisma validate` → **`pnpm db:drift`** (migrations vs schema, shadow DB `fitlens_shadow`; exit 2 = drift) → `turbo run lint typecheck test build` → `pnpm test:scripts`. Job `workflows`: actionlint 1.7.7 (also shellchecks `run:` blocks) + shellcheck on `infra/**/*.sh`. Job `docker`: api + web images (web with `NEXT_PUBLIC_API_URL`). `pnpm check` locally skips format, drift, build, docker, workflow lint.

## Deploy `.github/workflows/deploy.yml` (single ordered pipeline)

On successful CI `workflow_run` on main (or manual). WIF auth, no keys. `api-images` → `migrate` (Cloud Run job) → `api` → `web` → `app-update`.

- `api`: a shell step builds `--update-env-vars`/`--update-secrets` from repo vars: `AI_PROVIDER` picks the key secret; `APPLE_CLIENT_ID` set ⇒ Apple secrets mounted; `REVENUECAT_ENABLED=true` ⇒ RevenueCat secrets; `PAYWALL_ENABLED`. Always `PUBLIC_URL API_PUBLIC_URL AUTH_COOKIE_DOMAIN`. `--min-instances ${API_MIN_INSTANCES:-1}`, `--max-instances ${API_MAX_INSTANCES:-3}`, `--cpu-boost`. Smoke: run.app `/api/health` + `$API_PUBLIC_URL/api/health`.
- `web`: Vercel CLI (`pull/build --prod/deploy --prebuilt`) when secret `VERCEL_TOKEN` (+ vars `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`); else ghcr image (build arg `NEXT_PUBLIC_API_URL`) + `WEB_DEPLOY_HOOK_URL`. `apps/web/vercel.json` disables Vercel's own Git deploys of `main` (PR previews stay).
- `app-update`: matrix `preview`/`production`; only if secret `EXPO_TOKEN` and `apps/mobile`|`packages/contracts` changed since the last successful Deploy run's SHA; `eas update --channel X --environment X`.
- The old ungated `eas-update.yml` is deleted. Store builds: `mobile-release.yml` (manual: platform, profile, optional auto-submit).

## Provisioning and checks

- `infra/gcp/setup.sh` (idempotent): project/APIs/SAs/AR, Cloud SQL (default tier `db-custom-1-3840`, patches an existing instance + PITR), secrets incl. optional Apple (`.p8` from file) + RevenueCat (webhook auth generated), IAM, WIF, all repo vars, then `api-domain.sh`.
- `infra/gcp/api-domain.sh`: global HTTPS LB + serverless NEG + managed cert for `api.<site>` (Cloud Run domain mapping unsupported in asia-south1).
- `infra/release-check.sh`: read-only ✅/⚠️/❌ over GitHub vars/secrets, Secret Manager + IAM, SQL, Cloud Run, LB/cert/DNS, live API/web/CORS/Google redirect. `LIVE_ONLY=1` = live checks only (works on localhost).
- `infra/owner-setup.sh`: for the GitHub repo **admin** + Vercel owner (Tushar). Sets repo vars `API_PUBLIC_URL`, `AUTH_COOKIE_DOMAIN`, `API_MIN_INSTANCES`, `VERCEL_ORG_ID`/`VERCEL_PROJECT_ID` (via `vercel link` in apps/web), secret `VERCEL_TOKEN` (hidden prompt), Vercel env `NEXT_PUBLIC_API_URL` (Production), optional Vercel DNS A record for api.<site>; prints the Google OAuth redirect step. Refuses to run without repo admin.
- Access (2026-11-11): divyam070707@gmail.com has admin on GCP `fitlens-prod` but only push on the GitHub repo, so GitHub vars/secrets and Vercel go through owner-setup.sh.
- Runbook: `docs/RELEASE.md`.

## Docker

- `apps/api/Dockerfile`: node:22-alpine, `turbo@2 prune`, frozen install, build, `pnpm deploy --prod --legacy`; runner tini + node user + wget healthcheck; `migrate` target.
- `apps/web/Dockerfile`: Next standalone; build arg `NEXT_PUBLIC_API_URL`, optional runtime `API_INTERNAL_URL`.
- `docker-compose.yml`: postgres:17, redis:7, chainguard minio (untagged); profile `app` adds api/worker/web.

## Local

`scripts/local.mjs`: bootstrap (create `.env`, gen AUTH_SECRET, ports, compose up, migrate, seed if empty, sets `API_PUBLIC_URL` if missing, mobile `.env` with LAN IP → API port 4000), preflight, free, mobile, emulator, all, stop. Helpers tested in `scripts/lib/*.test.mjs`. Machine quirks: Node 22 via nvm (`export PATH=$HOME/.nvm/versions/node/v22.22.0/bin:$PATH`), Redis on 6380.

## Env templates

`.env.example` covers API vars (except `REVENUECAT_ENTITLEMENT`) + web/test/ports. `.env.production.example` has the web/API URL trio + PAYWALL/RevenueCat; still omits COACH_FREE/AI_PRO limits, AI model overrides, AUTH_DEV_LOGIN (defaults are right). Undocumented: web `APP_STORE_URL`/`PLAY_STORE_URL`; mobile `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_REVENUECAT_*`.

## Turbo

`turbo.json`: build `^build`, outputs dist/.next; test passes `TEST_DATABASE_URL`. Read installed turbo docs before changing config (AGENTS.md).
