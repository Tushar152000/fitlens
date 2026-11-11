# Decisions and open questions (hand-maintained)

Record decisions as `YYYY-MM-DD — decision — why`. Move a question to Decided when answered.

## Decided

- 2026-10-13 — Pro is ₹199/month or ₹1,499/year, 7-day trial, sold only in the phone apps via RevenueCat; web only shows the plan — docs/PREMIUM.md.
- 2026-11-11 — Dev knowledge base is local markdown in `.claude/context/` with hash-based staleness + hooks (no embeddings / no external service) — keeps code on the machine, fits grep+read workflow.
- Standing — `fitlens` identifiers (URL scheme, slug, cookie names, bucket, storage keys) stay frozen: renaming breaks deep links, OTA channels, sessions and stored photos.
- 2026-11-11 — Web is hosted on Vercel (response header `server: Vercel`); API on Cloud Run `fitlens-prod` asia-south1, deployed by GitHub Actions (last deploy 107c0ee, 2026-11-10).
- 2026-11-11 — Single backend: NestJS only, at `https://api.fitr8.com`; the web has no proxy/route handlers; session cookie Domain `.fitr8.com`. Clean cut-over (no real users yet, no compatibility rewrite).
- 2026-11-11 — Database stays PostgreSQL on Cloud SQL; move from `db-f1-micro` to a dedicated-core tier before launch; scale later by tier → HA → replicas → AlloyDB (all Postgres-compatible).
- 2026-11-11 — Ship everything together in one release after local verification.

## Open (need the owner's answer)

- Is the web staying read-only? Delete the unreachable web app screens (~6k lines) or revive a desktop shell?
- Paywall at launch: turn `PAYWALL_ENABLED` on, or hide Pro in the app until it is?
- Store status: are iOS/Android builds live, in review, or unsubmitted? (decides OTA blast radius)
- Production console config: which of Apple keys, RevenueCat keys, `PAYWALL_ENABLED`, `REDIS_URL`, `CORS_ORIGINS` are set on Cloud Run? Are RevenueCat keys in EAS env for `preview`?
- Sandbox purchases granting Pro in production: acceptable?
- Docs vs code: update docs to match code, or bring code back to ARCHITECTURE rules (e.g. module table ownership)?
