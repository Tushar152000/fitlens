# Deploying FITR8

The backend runs on **Google Cloud** (`asia-south1`, Mumbai). CI builds and ships everything from this repo.

| Piece                | Runs on                                                                     | Notes                                                       |
| -------------------- | --------------------------------------------------------------------------- | ----------------------------------------------------------- |
| API (`APP_ROLE=api`) | Cloud Run service `fitlens-api`, image in Artifact Registry                 | Scales 0 → 3 instances                                      |
| Migrations           | Cloud Run job `fitlens-migrate` (`--target migrate` of the same Dockerfile) | Runs before every rollout                                   |
| Database             | Cloud SQL Postgres 17 `fitlens-db` (`db-f1-micro`, daily backups)           | Reached only through the Cloud SQL socket; no open networks |
| Photos               | Cloudflare R2 bucket `fitlens-meals` (S3-compatible API)                    | Private; clients use signed URLs                            |
| Secrets              | Secret Manager                                                              | Mounted into the service and job as env vars                |
| Queue/locks          | none yet (`REDIS_URL` unset: jobs run inline in the request)                | Add Redis + a worker service when needed                    |
| Web                  | `ghcr.io/<repo>/web` (Next standalone), or Vercel with root `apps/web`      | Not on GCP                                                  |

Clients reach everything through **one public origin** (the web app). The web server proxies `/api/*` to the API at request time, so cookies are first-party and Google's redirect URI stays `https://<web>/api/auth/callback/google`. The mobile app also uses that origin (`EXPO_PUBLIC_API_URL` in `apps/mobile/eas.json`).

## 1. Photo storage (Cloudflare R2)

1. R2 → Create bucket `fitlens-meals` (location hint: Asia-Pacific).
2. Bucket → Settings → CORS policy (browsers upload straight to the bucket with signed URLs):

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

3. R2 → Manage API tokens → Create API token: **Object Read & Write**, scoped to that bucket only. Keep the page open: the setup script below asks for its **Access Key ID**, **Secret Access Key** and the **S3 endpoint** `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`. They go only into Secret Manager.

## 2. One-time Google Cloud setup

Use your own Google account and a dedicated project (not a work one):

```bash
gcloud auth login you@gmail.com
gcloud billing accounts list                       # note the ID
PROJECT_ID=fitlens-prod BILLING_ACCOUNT=XXXXXX-XXXXXX-XXXXXX \
  PUBLIC_URL=https://YOUR-WEB-ORIGIN CLOUDSDK_CORE_ACCOUNT=you@gmail.com \
  infra/gcp/setup.sh
```

[`infra/gcp/setup.sh`](../infra/gcp/setup.sh) is idempotent (re-run it any time). It never changes your active gcloud config. It:

- enables the APIs; creates Artifact Registry and Cloud SQL (instance, `fitlens` database and user);
- stores secrets in Secret Manager: `DATABASE_URL` (Cloud SQL socket form) and `AUTH_SECRET` (both generated), and asks with hidden input for `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `ANTHROPIC_API_KEY`, `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` (R2). Values are piped straight into Secret Manager, never echoed or written to disk, and never stored in GitHub;
- creates two service accounts: `fitlens-api` runs the service (Cloud SQL client, reads those secrets), `fitlens-deployer` is what GitHub Actions becomes through Workload Identity Federation (only `main` of this repo; no JSON keys);
- sets the GitHub repository variables the Deploy workflow reads (with `gh`, or prints them). None of them are secret;
- ends with a list of any secrets still missing (run it from a terminal to enter them).

Rotate a secret with `gcloud secrets versions add NAME --data-file=-`; the next deploy picks up `latest`.

## 3. First deploy and seed

Push to `main` (or run **Deploy** manually). The workflow creates the job and service on first run. Then seed foods and exercises once (idempotent upserts):

```bash
gcloud run jobs execute fitlens-migrate --project=fitlens-prod --region=asia-south1 --args=npx,prisma,db,seed --wait
```

The run summary prints the API URL (`https://fitlens-api-….run.app`); point the web app's `API_INTERNAL_URL` at it.

## 4. API configuration

The Deploy workflow sets these on every rollout (see `.github/workflows/deploy.yml`):

| Variable                                                                   | Value                                                          |
| -------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `APP_ENV`                                                                  | `production`: enables the strict checks below                  |
| `APP_ROLE`                                                                 | `api`                                                          |
| `PUBLIC_URL`                                                               | repo variable `PUBLIC_URL` (the web origin)                    |
| `DATABASE_URL`                                                             | secret; `…@localhost/fitlens?host=/cloudsql/<connection name>` |
| `DATABASE_POOL_MAX`                                                        | `5` (× 3 instances stays under `db-f1-micro`'s 25 connections) |
| `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `ANTHROPIC_API_KEY` | secrets (Google credentials are required in production)        |
| `AI_PROVIDER`                                                              | `anthropic`                                                    |
| `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`                  | secrets (R2)                                                   |
| `S3_REGION=auto`, `S3_BUCKET` (repo variable), `S3_FORCE_PATH_STYLE=true`  | R2                                                             |

Everything else in `apps/api/src/config/env.ts` keeps its default. Override it in the Cloud Run console (Edit & deploy new revision → Variables). The workflow only updates the variables above, so console-only ones such as `AI_DAILY_LIMIT`, `COACH_DAILY_LIMIT`, `SESSION_DAYS` / `MOBILE_SESSION_DAYS` / `SESSION_MAX_DAYS` (default 30, 90, 365), `AUTH_RATE_LIMIT` (default 20), `CORS_ORIGINS` and `OFF_CONTACT` survive deploys. Full list with comments: `.env.production.example`. Use a separate `AUTH_SECRET`, Google OAuth client and database per environment.

With `APP_ENV=staging` or `production` the API refuses to boot with `AUTH_DEV_LOGIN` on, without Google credentials, or with a non-https `PUBLIC_URL`, and never reads a `.env` file.

Health: startup and liveness probes hit `GET /api/health/live`; `GET /api/health` also checks the database.

**Adding Redis later:** create a Redis (Upstash, or Memorystore with a VPC connector), add a `REDIS_URL` secret, and deploy a second service from the same image with command `node dist/worker.js`, `APP_ROLE=worker`, `--no-cpu-throttling --min-instances=1`.

## 5. Web

**Vercel:** import the repo, root directory `apps/web`, framework Next.js; install command `pnpm install --frozen-lockfile`, build command `cd ../.. && pnpm turbo run build --filter=@fitr8/web`. Env: `API_INTERNAL_URL=https://<api-host>` (the API's own URL; browsers never call it directly).

**Container:** run `ghcr.io/<repo>/web:latest` with `API_INTERNAL_URL`, port 3000; set `WEB_DEPLOY_HOOK_URL`.

## 6. Google sign-in

Authorised redirect URI: `https://YOUR-WEB-ORIGIN/api/auth/callback/google` (the same URI serves web and app sign-in). While the consent screen is in Testing only listed test users can sign in; publishing needs no verification for name/email/photo scopes.

## 7. Release flow

Push to `main` → CI (lint, typecheck, tests, image builds) → Deploy workflow: API and migrate images pushed to Artifact Registry → `fitlens-migrate` job runs `prisma migrate deploy` → `fitlens-api` rolls out and is smoke-tested → web image and hook. Migrations run before the new code starts, so write them backwards-compatible (add columns nullable/defaulted first, drop in a later release). Roll back with `gcloud run services update-traffic fitlens-api --to-revisions=<previous>=100`.

Mobile: pushes touching `apps/mobile` or `packages/contracts` publish an EAS update to the `preview` channel; store builds with `cd apps/mobile && eas build --profile production`.

## 8. Check

- `https://<web>/api/health` → `{"status":"ok","db":"ok","redis":"ok"|"disabled"}`
- Sign in, onboard, snap a meal, scan a barcode, ask the coach "how am I doing today?".
