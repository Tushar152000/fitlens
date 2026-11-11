# Release runbook

Everything is automated except tokens and settings that only a person with the accounts can add.
Do the steps in order once; after that every merge to `main` releases by itself.

```
merge to main → CI (format, schema + migration drift, lint, typecheck, tests, build, workflow lint, images)
             → Deploy: images → migrations → API (Cloud Run) → web (Vercel) → app OTA (EAS)
               only the services whose code changed since the last successful deploy
               (Actions → Deploy → Run workflow → "all" deploys everything)
store builds → Actions → "Mobile release" (manual, when native code changed)
```

## 0. Access

- [ ] Your Google account can administer the GCP project `fitlens-prod` (the owner grants you **Owner**, or
      Editor + Security Admin). `gcloud auth login`, then `gcloud config set project fitlens-prod`.
- [ ] `gh auth login` with admin rights on the GitHub repository (to set variables and secrets).

## 1. Google Cloud: one command

```bash
PROJECT_ID=fitlens-prod PUBLIC_URL=https://www.fitr8.com infra/gcp/setup.sh
```

Safe to re-run; it skips what exists. It:

- moves Cloud SQL to `db-custom-1-3840` (dedicated core, **restarts the database for a few minutes**)
  and turns on point-in-time recovery;
- asks for any missing secret (hidden input, straight into Secret Manager): R2, Google OAuth, the AI
  key, and optionally Sign in with Apple (team id, key id, path to the `.p8`) and RevenueCat (secret key;
  the webhook password is generated);
- grants the API's service account access to them;
- creates the API's load balancer and certificate for `api.fitr8.com` (`infra/gcp/api-domain.sh`) and
  prints its IP;
- sets every GitHub repository variable the Deploy workflow reads (`GCP_*`, `PUBLIC_URL`,
  `API_PUBLIC_URL`, `AUTH_COOKIE_DOMAIN`, `S3_BUCKET`, `AI_PROVIDER`, `API_MIN_INSTANCES`,
  `APPLE_CLIENT_ID` when Apple is set up, `REVENUECAT_ENABLED`).

## 1b. Repository admin + Vercel owner: one command

GitHub variables/secrets need **admin** on the repository, and Vercel needs the project owner. If
setup.sh ran from an account without those, the admin runs (after `gh auth login` and `npx vercel login`):

```bash
infra/owner-setup.sh
```

It sets `API_PUBLIC_URL`, `AUTH_COOKIE_DOMAIN`, `API_MIN_INSTANCES`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`,
the `VERCEL_TOKEN` secret (pasted, hidden), Vercel's `NEXT_PUBLIC_API_URL`, and offers to add the DNS
record below in Vercel DNS. That covers steps 2 and 4.

## 2. DNS

- [ ] `A` record **`api.fitr8.com` → the IP setup.sh printed** (Vercel → Domains → fitr8.com → DNS).
      The certificate turns `ACTIVE` 15–60 minutes after the record resolves.

## 3. Google sign-in

- [ ] Google Cloud console → APIs & Services → Credentials → the OAuth client → Authorised redirect URIs:
      add **`https://api.fitr8.com/api/auth/callback/google`** (web and app sign-in both use it). The
      old `https://www.fitr8.com/api/...` entry can go after the release.

## 4. Vercel (web)

- [ ] Project → Settings → Environment Variables: **`NEXT_PUBLIC_API_URL=https://api.fitr8.com`** for
      Production (and Preview). Delete `API_INTERNAL_URL` if it is set to anything else.
- [ ] Account → Settings → Tokens → create one → GitHub secret **`VERCEL_TOKEN`**.
- [ ] GitHub variables **`VERCEL_ORG_ID`** (team settings → Team ID) and **`VERCEL_PROJECT_ID`** (project
      settings → General → Project ID).

Vercel no longer deploys `main` from Git by itself (`apps/web/vercel.json`); the Deploy workflow does,
after the API, so pages never call endpoints that aren't live. Pull-request previews still work.

## 5. Expo / EAS (app)

- [ ] expo.dev → Account settings → Access tokens → GitHub secret **`EXPO_TOKEN`** (OTA updates and
      store builds).
- [ ] If Pro purchases are on: EAS environment variables for `preview` and `production`:
      `EXPO_PUBLIC_REVENUECAT_IOS_KEY` (`appl_…`) and `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` (`goog_…`):
      `eas env:create --environment production --name EXPO_PUBLIC_REVENUECAT_IOS_KEY --value … --visibility plaintext`
- [ ] Before the first store submit: run `eas submit` once locally per platform so EAS stores the App
      Store Connect app / Play service account (fills `submit.production` in `apps/mobile/eas.json`).

The API URL is already in `eas.json` (`https://api.fitr8.com`).

## 6. RevenueCat (only with FITR8 Pro)

- [ ] Integrations → Webhooks → URL **`https://api.fitr8.com/api/billing/revenuecat`**, Authorization
      header = `gcloud secrets versions access latest --secret=REVENUECAT_WEBHOOK_AUTH --project=fitlens-prod`.
- [ ] When ready to charge: GitHub variable **`PAYWALL_ENABLED=true`** (the deploy refuses it without
      RevenueCat). Store products and the `pro` entitlement: [PREMIUM.md](PREMIUM.md).

## 7. Check, then release

```bash
PROJECT_ID=fitlens-prod infra/release-check.sh
```

Read-only. Every line must be ✅ (⚠️ are advice) before merging. Then merge to `main` and watch
Actions → CI → Deploy. After it finishes:

```bash
LIVE_ONLY=1 PUBLIC_URL=https://www.fitr8.com API_PUBLIC_URL=https://api.fitr8.com infra/release-check.sh
```

First release only: seed the food and exercise tables (idempotent upserts):

```bash
gcloud run jobs execute fitlens-migrate --project=fitlens-prod --region=asia-south1 --args=npx,prisma,db,seed --wait
```

## Knobs (GitHub variables, no code change)

| Variable                                  | Default  | Effect                                                      |
| ----------------------------------------- | -------- | ----------------------------------------------------------- |
| `API_MIN_INSTANCES` / `API_MAX_INSTANCES` | 1 / 3    | Warm instances (no cold starts) / ceiling                   |
| `AI_PROVIDER`                             | `openai` | `anthropic` switches extraction + coach (needs its key)     |
| `PAYWALL_ENABLED`                         | `false`  | Free-plan limits and Pro gating                             |
| `APPLE_CLIENT_ID`                         | unset    | Sign in with Apple (set by setup.sh when its secrets exist) |
| `REVENUECAT_ENABLED`                      | unset    | Mounts the RevenueCat secrets                               |

Scaling up later is configuration only: raise the Cloud SQL tier (`gcloud sql instances patch`), turn on
its high availability, raise `API_MAX_INSTANCES`, add Redis + a worker service (never `REDIS_URL` alone:
meal analysis would queue with nothing to run it).

## Rollback

- API: `gcloud run services update-traffic fitlens-api --region=asia-south1 --to-revisions=<previous>=100`
- Web: Vercel → Deployments → previous → Promote.
- App: `eas update:republish` the previous update group on the channel (or publish a fix).
- Database: migrations only move forward; write them backwards-compatible (add first, drop in a later
  release). Point-in-time recovery restores to a new instance if data must be recovered.
