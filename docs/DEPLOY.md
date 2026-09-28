# Deploying FitLens

Three deployables, all built by CI from this repo:

| Piece                      | Artifact                                                                         | Suggested host                                              |
| -------------------------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| API (`APP_ROLE=api`)       | `ghcr.io/<repo>/api` → `node dist/main.js`                                       | Any container host: Render, Railway, Fly.io, Cloud Run, ECS |
| Worker (`APP_ROLE=worker`) | same image, command `node dist/worker.js`                                        | Same host, separate service (only needed with Redis)        |
| Web                        | `ghcr.io/<repo>/web` (Next standalone), or Vercel with root directory `apps/web` | Vercel or the container host                                |
| Database                   | Postgres 16+                                                                     | Neon (Singapore/Mumbai)                                     |
| Photos                     | S3-compatible bucket                                                             | Cloudflare R2                                               |
| Queue/locks                | Redis 7 (optional)                                                               | Upstash / host add-on                                       |

Clients reach everything through **one public origin** (the web app). The web server proxies `/api/*` to the API at request time, so cookies are first-party and Google's redirect URI stays `https://<web>/api/auth/callback/google`. The mobile app also uses that origin (`EXPO_PUBLIC_API_URL` in `apps/mobile/eas.json`).

## 1. Database (Neon)

1. Create a project close to your users. Take two connection strings:
   - **pooled** (`…-pooler…`) → API `DATABASE_URL` (use `sslmode=verify-full`)
   - **direct** → GitHub secret `PRODUCTION_DATABASE_URL` (migrations don't work reliably through the pooler)
2. First time only, seed foods and exercises from your laptop: `DATABASE_URL=<direct> pnpm db:deploy && DATABASE_URL=<direct> pnpm db:seed`.

Pool sizing: `DATABASE_POOL_MAX` × (API + worker instances) must stay under the database's connection limit.

## 2. Photo storage (Cloudflare R2)

1. Create bucket `fitlens-meals`. CORS policy (clients upload straight to the bucket with signed URLs):

```json
[
  {
    "AllowedOrigins": ["https://YOUR-WEB-ORIGIN"],
    "AllowedMethods": ["PUT", "GET"],
    "AllowedHeaders": ["content-type"],
    "MaxAgeSeconds": 3600
  }
]
```

2. Create an API token with Object Read & Write on that bucket. Endpoint: `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`.

## 3. API and worker

Create a service from image `ghcr.io/<repo>/api:latest` (make the GHCR package readable by the host, or add registry credentials). Health checks: liveness `GET /api/health/live`, readiness `GET /api/health`. Port 4000.

| Variable                                                                                                             | Value                                                            |
| -------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `NODE_ENV`                                                                                                           | `production`                                                     |
| `APP_ROLE`                                                                                                           | `api` (or `all` for a single instance without a separate worker) |
| `PUBLIC_URL`                                                                                                         | `https://YOUR-WEB-ORIGIN`                                        |
| `DATABASE_URL`                                                                                                       | Neon pooled string                                               |
| `REDIS_URL`                                                                                                          | optional; enables background jobs, cross-instance locks          |
| `AUTH_SECRET`                                                                                                        | `openssl rand -base64 33` (keep it: it signs sign-in codes)      |
| `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`                                                                               | Google OAuth client                                              |
| `S3_ENDPOINT`, `S3_REGION=auto`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_FORCE_PATH_STYLE=true` | R2                                                               |
| `AI_PROVIDER`                                                                                                        | `anthropic`                                                      |
| `ANTHROPIC_API_KEY`                                                                                                  | your key                                                         |
| `AI_DAILY_LIMIT`, `COACH_DAILY_LIMIT`                                                                                | per-user daily caps (default 3 and 40)                           |
| `OFF_CONTACT`                                                                                                        | contact for Open Food Facts (optional)                           |

Never set `AUTH_DEV_LOGIN` in production (the API refuses to boot with it).

With Redis, add a second service from the same image with command `node dist/worker.js` and `APP_ROLE=worker`, same env. Scale API instances on request load and workers on queue depth independently.

Put the host's deploy hook URL in GitHub secret `API_DEPLOY_HOOK_URL` (trigger both API and worker).

## 4. Web

**Vercel:** import the repo, root directory `apps/web`, framework Next.js; install command `pnpm install --frozen-lockfile`, build command `cd ../.. && pnpm turbo run build --filter=@fitlens/web`. Env: `API_INTERNAL_URL=https://<api-host>` (the API's own URL; browsers never call it directly).

**Container:** run `ghcr.io/<repo>/web:latest` with `API_INTERNAL_URL`, port 3000; set `WEB_DEPLOY_HOOK_URL`.

## 5. Google sign-in

Authorised redirect URI: `https://YOUR-WEB-ORIGIN/api/auth/callback/google` (unchanged from the Auth.js setup). While the consent screen is in Testing only listed test users can sign in; publishing needs no verification for name/email/photo scopes.

## 6. Release flow

Push to `main` → CI (lint, typecheck, tests, image builds) → Deploy workflow: images pushed to GHCR → `prisma migrate deploy` with `PRODUCTION_DATABASE_URL` → deploy hooks. Migrations run before the new code starts, so write them backwards-compatible (add columns nullable/defaulted first, drop in a later release).

Mobile: pushes touching `apps/mobile` or `packages/contracts` publish an EAS update to the `preview` channel; store builds with `cd apps/mobile && eas build --profile production`.

## 7. Check

- `https://<web>/api/health` → `{"status":"ok","db":"ok","redis":"ok"|"disabled"}`
- Sign in, onboard, snap a meal, scan a barcode, ask the coach "how am I doing today?".
