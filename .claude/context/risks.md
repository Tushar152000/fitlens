# Known issues and ship risks (hand-maintained)

Ranked. ✔ = re-read in code and confirmed. Remove an item (or mark FIXED with the commit) when it is fixed.
Baseline: HEAD 107c0ee, 2026-11-11.

## Blockers / high

1. FIXED (branch feat/ai-coach-knowledge, 2026-11-19): coach daily cap now counts only typed user messages (`text <> ''`), so tool_result rows no longer use up the limit; e2e "counts only typed messages".
2. ✔ **Auth cleanup never runs in prod.** `auth-cleanup.service.ts:33` skips `APP_ROLE=api`; prod runs only api. Sessions/codes/events grow forever; "90-day retention" false.
3. FIXED (uncommitted): OTA now runs as the last Deploy job, after the API, with `--environment` per channel (preview + production).
4. PARTLY FIXED (uncommitted, 2026-11-12): profile plan card + photo-scan limit sheet now show Pro only when `usage.paywall` and an SDK key; profile header pill reads `usage.plan`. Still open: label 402 and coach 429 have no Pro CTA; `pro.tsx` itself doesn't check `paywall` (only reachable from gated buttons).
5. FIXED (uncommitted, 2026-11-12): offline launch → `status: "offline"` + retry screen (`_layout.tsx` `OfflineStart`); only a 401 signs out.
6. **Rate-limit IP**: clients now hit the API directly through the HTTPS load balancer; verify `req.ip` is the client after deploy (`trust proxy` 1 vs LB + Google front end hops). Web SSR still forwards the browser's `x-forwarded-for`. Throttler + coach lock per instance (no Redis).
7. FIXED (uncommitted): Apple, RevenueCat, PAYWALL, min instances are repo variables + Secret Manager via setup.sh; verified by `infra/release-check.sh`.

## Medium

- **iOS build with RN Firebase unverified (2026-11-13).** `app.config.ts` forces iOS `useFrameworks: "dynamic"` (RN Firebase v27 requirement; officially tested on Expo 58, we are on 57). Never built for iOS here (Linux); first EAS iOS build may fail in pods (worklets, purchases). Android release build verified.

8. 500s instead of 400: unvalidated `?date` (meals, dashboard), invalid onboarding timezone, workout plan find-then-create race (P2002; GET `/water` + `/workouts/today` in parallel), label save twice (duplicate Food / P2002), OFF timeout.
9. POST `/water` before onboarding inserts then 404s (also coach `log_water`).
10. HEIC accepted for upload but extractors can't read it. Presigned PUT unbounded size; `getImage` buffers before 10 MB check. Photos not deleted on meal delete.
11. Barcode hijack: unverified label-scan Food claims a barcode → everyone else gets not_found, permanent after account delete (`submittedById` no FK). OFF imports `isVeg: true` always.
12. Mobile: iOS keeps only 64 pending local notifications per app; water reminders schedule up to 49 one-offs, custom reminders up to 24 repeating alerts each (max 20 reminders) — heavy users can exceed it and iOS silently drops the rest (unverified on device). Custom reminders + barcode-in-photo never run on a real device here (only web preview + typecheck). Lunch/dinner reminders never delivered. OfflineBanner promises sync that doesn't exist. FIXED 2026-11-12 (uncommitted): purchase-then-refresh-failure shows "payment received" instead of an error; water reminders cancelled in `auth.tsx` `clear()`; invalidations after onboarding (all), check-in (plan, day), scans (`refreshDay` → usage); `history.tsx` empty guard.
13. Food visibility: `buildItem`/`logItems` with a `foodId` skip the unreviewed-label check that `quickAdd` has (saved meals check it, `saved-meals.service.ts:117`). Saved-meal items are snapshots: editing a Food row later doesn't re-price them.
14. FIXED (feat/ai-coach-knowledge): OpenAI coach keeps the chat's first message plus the last ~60 messages, cut at a typed message (`recentHistory` in `openai.gateway.ts`).
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

- **Deploys report failure since 2026-11-11** (runs 43026714879, 43385844433, 43848848119): `changes`, images, migrate and `api` succeed; `web` fails at Vercel CLI "--token … contents are invalid" (`VERCEL_TOKEN` secret malformed), the change diff keeps comparing against 2026-11-10. FIXED on branch feat/barcode-templates-reminders: `app-update` now needs only `changes` + `api`, so OTA ships even while the web step fails. Still open: rotate `VERCEL_TOKEN`.

## Doc drift (code is truth; fix docs in the PR that touches the area)

ARCHITECTURE §3.6 "Google only" + "worker cleanup hourly"; §3.2 ownership table; §3.1 "every query validated"; §2 "domain 100% tested"; §3.4 "Redis lock". WEBSITE.md `/today`, desktop shell "built". DESIGN.md manifest start `/today`. PREMIUM.md "typing unlimited" (60/day), "paywall off hides prompts" (app doesn't). DEPLOY.md "full list". mobile README sign-in path and port.

19. Onboarding step 1 (2026-11-18, uncommitted): phone numbers are stored but never verified (no OTP), so they're user-claimed only. Flag emoji render as letters on Windows. Mobile step 0 + country sheet only typechecked/linted, never run on a device. `apps/mobile/src/lib/person.ts` is a hand copy of the domain file — drift risk. Edit-goal now drops waist/neck for weight goals, so those users' new body metrics carry no body-fat estimate. Privacy page + STORE.md list the phone; needs owner review before release. GET `/profile/phone-check` + the 409 reveal that a number has an account (signed-in only, no per-route rate limit). The AI coach reads no profile data (not injuries, medical flag or the new medical note) despite the onboarding copy implying they shape the plan. Web `/welcome` signed-out flow can only learn a number is taken after sign-in.
