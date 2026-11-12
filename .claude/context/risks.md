# Known issues and ship risks (hand-maintained)

Ranked. ✔ = re-read in code and confirmed. Remove an item (or mark FIXED with the commit) when it is fixed.
Baseline: HEAD 107c0ee, 2026-11-11.

## Blockers / high

1. ✔ **Coach daily cap counts tool_result rows.** `apps/api/src/modules/coach/coach.service.ts:66` counts every `role:"user"` row; tool results are stored as `role:"user"`. Tool-using messages cost 2+. Free (paywall on) ≈ 2 real messages, not 5. e2e seeds fake rows so doesn't catch it.
2. ✔ **Auth cleanup never runs in prod.** `auth-cleanup.service.ts:33` skips `APP_ROLE=api`; prod runs only api. Sessions/codes/events grow forever; "90-day retention" false.
3. FIXED (uncommitted): OTA now runs as the last Deploy job, after the API, with `--environment` per channel (preview + production).
4. PARTLY FIXED (uncommitted, 2026-11-12): profile plan card + photo-scan limit sheet now show Pro only when `usage.paywall` and an SDK key; profile header pill reads `usage.plan`. Still open: label 402 and coach 429 have no Pro CTA; `pro.tsx` itself doesn't check `paywall` (only reachable from gated buttons).
5. FIXED (uncommitted, 2026-11-12): offline launch → `status: "offline"` + retry screen (`_layout.tsx` `OfflineStart`); only a 401 signs out.
6. **Rate-limit IP**: clients now hit the API directly through the HTTPS load balancer; verify `req.ip` is the client after deploy (`trust proxy` 1 vs LB + Google front end hops). Web SSR still forwards the browser's `x-forwarded-for`. Throttler + coach lock per instance (no Redis).
7. FIXED (uncommitted): Apple, RevenueCat, PAYWALL, min instances are repo variables + Secret Manager via setup.sh; verified by `infra/release-check.sh`.

## Medium

8. 500s instead of 400: unvalidated `?date` (meals, dashboard), invalid onboarding timezone, workout plan find-then-create race (P2002; GET `/water` + `/workouts/today` in parallel), label save twice (duplicate Food / P2002), OFF timeout.
9. POST `/water` before onboarding inserts then 404s (also coach `log_water`).
10. HEIC accepted for upload but extractors can't read it. Presigned PUT unbounded size; `getImage` buffers before 10 MB check. Photos not deleted on meal delete.
11. Barcode hijack: unverified label-scan Food claims a barcode → everyone else gets not_found, permanent after account delete (`submittedById` no FK). OFF imports `isVeg: true` always.
12. Mobile: lunch/dinner reminders never delivered. OfflineBanner promises sync that doesn't exist. FIXED 2026-11-12 (uncommitted): purchase-then-refresh-failure shows "payment received" instead of an error; water reminders cancelled in `auth.tsx` `clear()`; invalidations after onboarding (all), check-in (plan, day), scans (`refreshDay` → usage); `history.tsx` empty guard.
13. Food visibility: `buildItem`/`logItems` with a `foodId` skip the unreviewed-label check that `quickAdd` has.
14. OpenAI coach: no compaction and no history cap → long threads eventually fail.
15. Sandbox purchases grant Pro in prod (intentional for App Review; TestFlight testers get real Pro).
16. Seed food values are placeholders (launch item) — the main accuracy limit: matched items take nutrition from these 32 rows.
17. Photo-meal latency (2026-11-11): model call dominates; also Cloud Run `min-instances=0` cold starts, 3 phone→server hops (upload-url, PUT to R2, POST /meals) plus a server R2 GET, no streaming (user sees nothing until the whole JSON is done), app re-fetches GET /meals/:id after a 201. Food-name "contains" matching (wrong dish/kcal) FIXED in this change.

## Low

18. UTC `ymd()` in web `draft.ts:31` + mobile `onboarding-draft.ts:35` → off-by-one before 05:30 IST.
19. Web: 401 redirect drops `?next`; `/login?error=` reflects text; no security headers (CSP/HSTS); landing store links may be build-time.
20. CSV export no formula-injection guard; DELETE /account doesn't clear cookie; Google `code` logged via URL.
21. Domain: macros can exceed kcal for heavy users at floor; recomposition phase flips on rounding; `ageFromBirthDate` local-time.
22. Unpinned: node:22-alpine, postgres:17, redis:7, minio untagged, `turbo@2`, `eas-version: latest`.
23. Duplicated logic mobile↔web/domain with no sync test.

## Doc drift (code is truth; fix docs in the PR that touches the area)

ARCHITECTURE §3.6 "Google only" + "worker cleanup hourly"; §3.2 ownership table; §3.1 "every query validated"; §2 "domain 100% tested"; §3.4 "Redis lock". WEBSITE.md `/today`, desktop shell "built". DESIGN.md manifest start `/today`. PREMIUM.md "typing unlimited" (60/day), "paywall off hides prompts" (app doesn't). DEPLOY.md "full list". mobile README sign-in path and port.
