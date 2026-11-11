# Deploying FITR8

The backend runs on **Google Cloud** (`asia-south1`, Mumbai). CI builds and ships everything from this repo.
**Step-by-step release (tokens, settings, the pre-release check): [RELEASE.md](RELEASE.md).** This page is the reference.

| Piece                | Runs on                                                                     | Notes                                                       |
| -------------------- | --------------------------------------------------------------------------- | ----------------------------------------------------------- |
| API (`APP_ROLE=api`) | Cloud Run service `fitlens-api`, image in Artifact Registry                 | 1 → 3 instances (`API_MIN_INSTANCES` / `API_MAX_INSTANCES`) |
| Migrations           | Cloud Run job `fitlens-migrate` (`--target migrate` of the same Dockerfile) | Runs before every rollout                                   |
| Database             | Cloud SQL Postgres 17 `fitlens-db` (`db-f1-micro`, daily backups)           | Reached only through the Cloud SQL socket; no open networks |
| Photos               | Cloudflare R2 bucket `fitlens-meals` (S3-compatible API)                    | Private; clients use signed URLs                            |
| Secrets              | Secret Manager                                                              | Mounted into the service and job as env vars                |
| Queue/locks          | none yet (`REDIS_URL` unset: jobs run inline in the request)                | Add Redis + a worker service when needed                    |
| Web                  | `ghcr.io/<repo>/web` (Next standalone), or Vercel with root `apps/web`      | Not on GCP                                                  |

**One backend, its own domain.** The NestJS API is served at `https://api.fitr8.com`; the web (`https://www.fitr8.com`) has no API routes or proxy. Browsers call the API directly (CORS allows `PUBLIC_URL`, with credentials), the web's server rendering calls it with the user's cookie, and the app calls it with a bearer token (`EXPO_PUBLIC_API_URL` in `apps/mobile/eas.json`). The API sets the session cookie for `.fitr8.com` (`AUTH_COOKIE_DOMAIN`) so both hosts see it. Google's redirect URI is `https://api.fitr8.com/api/auth/callback/google`.

**API domain:** Cloud Run domain mapping isn't available in asia-south1 (and is preview-only), so `api.fitr8.com` goes through a global external HTTPS load balancer: run `PROJECT_ID=fitlens-prod DOMAIN=api.fitr8.com infra/gcp/api-domain.sh` once, add the printed A record to DNS, wait for the certificate to become ACTIVE.

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
- stores secrets in Secret Manager: `DATABASE_URL` (Cloud SQL socket form) and `AUTH_SECRET` (both generated), and asks with hidden input for `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `OPENAI_API_KEY` (or `ANTHROPIC_API_KEY` with `AI_PROVIDER=anthropic`), `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` (R2). Values are piped straight into Secret Manager, never echoed or written to disk, and never stored in GitHub;
- creates two service accounts: `fitlens-api` runs the service (Cloud SQL client, reads those secrets), `fitlens-deployer` is what GitHub Actions becomes through Workload Identity Federation (only `main` of this repo; no JSON keys);
- sets the GitHub repository variables the Deploy workflow reads (with `gh`, or prints them). None of them are secret;
- ends with a list of any secrets still missing (run it from a terminal to enter them).

Rotate a secret with `gcloud secrets versions add NAME --data-file=-`; the next deploy picks up `latest`.

## 3. First deploy and seed

Push to `main` (or run **Deploy** manually). The workflow creates the job and service on first run. Then seed foods and exercises once (idempotent upserts):

```bash
gcloud run jobs execute fitlens-migrate --project=fitlens-prod --region=asia-south1 --args=npx,prisma,db,seed --wait
```

The run summary prints the Cloud Run URL (`https://fitlens-api-….run.app`); the public address is `https://api.fitr8.com` (load balancer, above).

## 4. API configuration

The Deploy workflow sets these on every rollout (see `.github/workflows/deploy.yml`):

| Variable                                                                  | Value                                                                                                       |
| ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `APP_ENV`                                                                 | `production`: enables the strict checks below                                                               |
| `APP_ROLE`                                                                | `api`                                                                                                       |
| `PUBLIC_URL`                                                              | repo variable `PUBLIC_URL` (the web origin)                                                                 |
| `DATABASE_URL`                                                            | secret; `…@localhost/fitlens?host=/cloudsql/<connection name>`                                              |
| `DATABASE_POOL_MAX`                                                       | `5` (× 3 instances stays under `db-f1-micro`'s 25 connections)                                              |
| `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `OPENAI_API_KEY`   | secrets (Google credentials are required in production)                                                     |
| `AI_PROVIDER`                                                             | repo variable `AI_PROVIDER` (`openai` by default, or `anthropic`, which mounts `ANTHROPIC_API_KEY` instead) |
| `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`                 | secrets (R2)                                                                                                |
| `S3_REGION=auto`, `S3_BUCKET` (repo variable), `S3_FORCE_PATH_STYLE=true` | R2                                                                                                          |

Everything else in `apps/api/src/config/env.ts` keeps its default. Override it in the Cloud Run console (Edit & deploy new revision → Variables). The workflow only updates the variables above, so console-only ones such as `AI_DAILY_LIMIT`, `COACH_DAILY_LIMIT`, `SESSION_DAYS` / `MOBILE_SESSION_DAYS` / `SESSION_MAX_DAYS` (default 30, 90, 365), `AUTH_RATE_LIMIT` (default 20), `CORS_ORIGINS` and `OFF_CONTACT` survive deploys. Full list with comments: `.env.production.example`. Use a separate `AUTH_SECRET`, Google OAuth client and database per environment.

With `APP_ENV=staging` or `production` the API refuses to boot with `AUTH_DEV_LOGIN` on, without Google credentials, or with a non-https `PUBLIC_URL`, and never reads a `.env` file.

Health: startup and liveness probes hit `GET /api/health/live`; `GET /api/health` also checks the database.

**Adding Redis later:** create a Redis (Upstash, or Memorystore with a VPC connector), add a `REDIS_URL` secret, and deploy a second service from the same image with command `node dist/worker.js`, `APP_ROLE=worker`, `--no-cpu-throttling --min-instances=1`.

## 5. Web

**Vercel:** import the repo, root directory `apps/web`, framework Next.js; install command `pnpm install --frozen-lockfile`, build command `cd ../.. && pnpm turbo run build --filter=@fitr8/web`. Env: `NEXT_PUBLIC_API_URL=https://api.fitr8.com` (used by the browser and, unless `API_INTERNAL_URL` is set, by server rendering). It's inlined at build time, so redeploy the web after changing it.

**Container:** build with `--build-arg NEXT_PUBLIC_API_URL=https://api.fitr8.com`, run on port 3000 (optionally `API_INTERNAL_URL`); set `WEB_DEPLOY_HOOK_URL`.

## 6. Sign in with Apple (iOS app)

Set `APPLE_CLIENT_ID=com.fitr8.app`, `APPLE_TEAM_ID`, `APPLE_KEY_ID` and `APPLE_PRIVATE_KEY` (the
`.p8` contents, from Secret Manager) on the Cloud Run service in the console; the Deploy workflow
leaves them alone. With `APPLE_CLIENT_ID` set, production refuses to boot without the other three:
account deletion revokes Apple sign-ins. Full steps: [STORE.md §2](STORE.md).

## 7. Google sign-in

Authorised redirect URI: `https://api.fitr8.com/api/auth/callback/google` (`$API_PUBLIC_URL/api/auth/callback/google`; the same URI serves web and app sign-in). While the consent screen is in Testing only listed test users can sign in; publishing needs no verification for name/email/photo scopes.

## 8. Release flow

Push to `main` → CI (format, migration drift, lint, typecheck, tests, workflow lint, image builds) → Deploy workflow: API and migrate images pushed to Artifact Registry → `fitlens-migrate` job runs `prisma migrate deploy` → `fitlens-api` rolls out and is smoke-tested (Cloud Run URL and `API_PUBLIC_URL`) → web deployed to Vercel (`VERCEL_TOKEN`; otherwise the ghcr image + hook) → EAS update. Migrations run before the new code starts, so write them backwards-compatible (add columns nullable/defaulted first, drop in a later release). Roll back with `gcloud run services update-traffic fitlens-api --to-revisions=<previous>=100`.

Mobile: the Deploy workflow's last job publishes an EAS update to the `preview` and `production` channels (with that EAS environment's variables) when `apps/mobile` or `packages/contracts` changed since the last successful deploy. Store builds: Actions → "Mobile release".

## 9. Check

- `infra/release-check.sh` (everything) or `LIVE_ONLY=1 … infra/release-check.sh` (live web + API only).
- `https://api.fitr8.com/api/health` → `{"status":"ok","db":"ok","redis":"ok"|"disabled"}`
- Sign in, onboard, snap a meal, scan a barcode, ask the coach "how am I doing today?".
