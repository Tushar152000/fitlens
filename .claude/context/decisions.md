# Decisions and open questions (hand-maintained)

Record decisions as `YYYY-MM-DD — decision — why`. Move a question to Decided when answered.

## Decided

- 2026-11-17 — App tab bar is Today · Workout · [camera] · Coach · Profile; Progress moved to a card on Today (+ `/progress` stack screen); Today's workout card and "Ask your coach" row removed; "History" link renamed "Past logs".
- 2026-11-17 — Returning users: re-login never repeats onboarding; after 90+ days without app use (`users.lastActiveAt`, touched by GET /me hourly) the app asks only weight, height, waist/neck if body-fat goal, activity, equipment, training days/minutes, injuries, medical flag (`POST /api/welcome-back`, goal kept, targets recomputed; "Not now" = `POST /api/me/active`). Web does not show it (read-only).
- 2026-11-17 — Dark mode (app only): System/Light/Dark in Profile, palette in `apps/mobile/src/lib/palette.ts` designed (not inverted), `userInterfaceStyle: automatic` → app version 0.4.0 (store build). Web stays light.
- 2026-10-13 — Pro is ₹199/month or ₹1,499/year, 7-day trial, sold only in the phone apps via RevenueCat; web only shows the plan — docs/PREMIUM.md.
- 2026-11-11 — Dev knowledge base is local markdown in `.claude/context/` with hash-based staleness + hooks (no embeddings / no external service) — keeps code on the machine, fits grep+read workflow.
- Standing — `fitlens` identifiers (URL scheme, slug, cookie names, bucket, storage keys) stay frozen: renaming breaks deep links, OTA channels, sessions and stored photos.
- 2026-11-11 — Web is hosted on Vercel (response header `server: Vercel`); API on Cloud Run `fitlens-prod` asia-south1, deployed by GitHub Actions (last deploy 107c0ee, 2026-11-10).
- 2026-11-11 — Single backend: NestJS only, at `https://api.fitr8.com`; the web has no proxy/route handlers; session cookie Domain `.fitr8.com`. Clean cut-over (no real users yet, no compatibility rewrite).
- 2026-11-11 — Database stays PostgreSQL on Cloud SQL; move from `db-f1-micro` to a dedicated-core tier before launch; scale later by tier → HA → replicas → AlloyDB (all Postgres-compatible).
- 2026-11-11 — Ship everything together in one release after local verification.

- 2026-11-11 — Testing phase cost mode: Cloud SQL back to `db-f1-micro` (backups + PITR kept) and Cloud Run min instances 0, until testing ends. Then: `gcloud sql instances patch fitlens-db --project=fitlens-prod --tier=db-custom-1-3840` and repo var `API_MIN_INSTANCES=1`. Until then run setup.sh with `SQL_TIER=db-f1-micro` (its default would upgrade).

- 2026-11-17 — Custom reminders: server stores only title/description/`crons[]`/enabled; several rules per reminder; cron extended with L, L-n, d#n, dL, months. Fixed shapes repeat on the phone (daily/weekly/monthly ≤ 28th); changing dates are scheduled as the next 3 exact times and re-planned on app launch (stop after ~3 occurrences if the app is never opened). No push server.
- 2026-11-16 — Saved meals store priced item snapshots (like a confirmed meal), logged with no AI call; separate from auto "usuals".
- 2026-11-16 — Photo shutter checks for a barcode (live, then in the still) before using the AI; barcode → existing product/portion screen.

## Open (need the owner's answer)

- Is the web staying read-only? Delete the unreachable web app screens (~6k lines) or revive a desktop shell?
- Paywall at launch: turn `PAYWALL_ENABLED` on, or hide Pro in the app until it is?
- Store status: are iOS/Android builds live, in review, or unsubmitted? (decides OTA blast radius)
- Production console config: which of Apple keys, RevenueCat keys, `PAYWALL_ENABLED`, `REDIS_URL`, `CORS_ORIGINS` are set on Cloud Run? Are RevenueCat keys in EAS env for `preview`?
- Sandbox purchases granting Pro in production: acceptable?
- Docs vs code: update docs to match code, or bring code back to ARCHITECTURE rules (e.g. module table ownership)?
