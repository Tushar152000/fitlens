# Deploying FitLens (Vercel + Neon + Cloudflare R2)

Free tiers cover a handful of users. No Redis or worker: without `REDIS_URL`, meals are analysed inside the request (`maxDuration = 60` on the AI routes).

| Piece    | Service                                                    | What you need from it                      |
| -------- | ---------------------------------------------------------- | ------------------------------------------ |
| App      | [Vercel](https://vercel.com) (Hobby)                       | Import the GitHub repo                     |
| Database | [Neon](https://neon.tech) (Free)                           | Postgres connection string                 |
| Photos   | [Cloudflare R2](https://dash.cloudflare.com) (Free, 10 GB) | Bucket + S3 API token                      |
| Sign-in  | Google Cloud OAuth client (existing)                       | Production redirect URI                    |
| AI       | OpenAI (existing key)                                      | Billed per photo; `AI_DAILY_LIMIT` caps it |

## 1. Database (Neon)

1. Create a project (region: Singapore or Mumbai, closest to India).
2. Get two connection strings (Dashboard → **Connect**, or `neon connection-string production --project-id <id> [--pooled]`):
   - **pooled** (`…-pooler…`) for the app → Vercel `DATABASE_URL`. Change `sslmode=require` to `sslmode=verify-full` (same security as today; silences a `pg` warning).
   - **direct** (no `-pooler`) for migrations — schema changes don't work reliably through the pooler.
3. Create tables and seed foods from your laptop, pointing at the **direct** string:

```bash
DATABASE_URL="postgresql://…neon.tech/neondb?sslmode=require" npx prisma migrate deploy
DATABASE_URL="postgresql://…neon.tech/neondb?sslmode=require" npm run db:seed
```

## 2. Photo storage (Cloudflare R2)

1. R2 → **Create bucket** `fitlens-meals` (location: Asia-Pacific).
2. Bucket → Settings → **CORS policy** (the browser uploads straight to R2):

```json
[
  {
    "AllowedOrigins": ["https://YOUR-APP.vercel.app"],
    "AllowedMethods": ["PUT", "GET"],
    "AllowedHeaders": ["content-type"],
    "MaxAgeSeconds": 3600
  }
]
```

3. R2 → **Manage API tokens** → Create token, permission **Object Read & Write**, limited to this bucket. Note the Access Key ID, Secret, and the S3 endpoint `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`.

## 3. App (Vercel)

1. **Add New → Project →** import `Tushar152000/fitlens`, branch `main` (merge `feat/app-ui` first).
2. Framework: Next.js (auto). Build command: default.
3. **Environment variables** (Production):

| Name                                       | Value                                                 |
| ------------------------------------------ | ----------------------------------------------------- |
| `DATABASE_URL`                             | Neon pooled string                                    |
| `AUTH_SECRET`                              | new value: `openssl rand -base64 33`                  |
| `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`     | from Google Cloud                                     |
| `S3_ENDPOINT`                              | `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`       |
| `S3_REGION`                                | `auto`                                                |
| `S3_BUCKET`                                | `fitlens-meals`                                       |
| `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | R2 token                                              |
| `S3_FORCE_PATH_STYLE`                      | `true`                                                |
| `AI_PROVIDER`                              | `openai`                                              |
| `OPENAI_API_KEY`                           | your key                                              |
| `AI_VISION_MODEL`                          | `gpt-4.1-mini`                                        |
| `AI_DAILY_LIMIT`                           | `3`                                                   |
| `OFF_CONTACT`                              | a contact URL or email for Open Food Facts (optional) |

Do **not** set `AUTH_URL` or `REDIS_URL` on Vercel.

4. Deploy, then note the address, e.g. `https://fitlens-xyz.vercel.app`.

## 4. Google sign-in

1. Google Cloud → Credentials → your OAuth client → **Authorised redirect URIs** → add
   `https://YOUR-APP.vercel.app/api/auth/callback/google`.
2. OAuth consent screen: while it's in **Testing**, only listed **test users** can sign in (up to 100) — add each friend's Gmail. Or **Publish app**: FitLens only asks for name, email and photo, which don't need Google verification.

## 5. Check

- `https://YOUR-APP.vercel.app/api/health` → `{"status":"ok","db":"ok"}`
- Sign in, onboard, snap a meal, scan a barcode.

## Updating

Push to `main` → Vercel redeploys. After a schema change, run step 1.3's `migrate deploy` against Neon's **direct** string before (or right after) the deploy.
