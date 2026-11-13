# apps/web — Next.js 16 (pure API client)

Paths relative to `apps/web/src/`. `next` 16.3.6, React 19.2. Read `node_modules/next/dist/docs/` before Next-specific code (AGENTS.md).

## What the web is today

Landing + legal + onboarding + read-only `/home`. Logging, coach, tabs live in the phone app.

- `app/(app)/(tabs)/layout.tsx`: `await requireOnboardedViewer(); redirect("/home")` — today/workout/progress/history/profile unreachable, children never rendered.
- `app/(app)/log/layout.tsx`, `app/(app)/coach/layout.tsx`: unconditional `redirect("/home")`.
- That screen code (~6k lines) still compiles and is maintained; `components/side-nav.tsx`, `components/app-column.tsx` are not wired anywhere. Reviving desktop = rewriting layouts, not just removing redirects.

## Next 16 conventions used

- **No backend in Next** (2026-11-11): no `proxy.ts`, no route handlers, no rewrites. Browser calls the API directly via `apiUrl()` (`lib/api-url.ts`, `NEXT_PUBLIC_API_URL`, inlined at build; default `http://localhost:4000`) with `credentials: "include"`. Server rendering uses `apiBaseUrl()` (`lib/api-base.ts`: `API_INTERNAL_URL` → `NEXT_PUBLIC_API_URL` → localhost:4000) and forwards the cookie.
- `PageProps<"/route">` global types (needs `next typegen`; typecheck = `next typegen && tsc --noEmit`). `params`/`searchParams` are Promises, always awaited.
- `vercel.json`: `git.deploymentEnabled.main = false` — production web deploys come only from the Deploy workflow (after the API); PR previews still deploy.
- `next.config.ts`: `output: "standalone"`, `allowedDevOrigins`, unused `serverActions.allowedOrigins`.
- No `"use cache"`/revalidate; server fetches use `cache: "no-store"`; per-request dedupe via React `cache()`.
- No `loading.tsx` / `error.tsx` / `not-found.tsx` / `global-error.tsx`. No service worker. Manifest `app/manifest.ts` (`start_url: "/home"`, theme `#8116E0`; root viewport themeColor `#f6f6f8`).

## Routes

- `/` `(marketing)/page.tsx` server; no auth check. `TargetCalculator` (client) uses `previewTarget` from `@fitr8/domain/nutrition`, stashes to sessionStorage → `/welcome`. `Hero`/`GetTheApp` read `storeLinks()` (`components/store-links.tsx`: `APP_STORE_URL`/`PLAY_STORE_URL`) — page may be statically prerendered, so runtime env might not apply (unverified).
- `/privacy`, `/terms` static `LegalPage`. Contact `ask@fitr8.com` hardcoded.
- `/welcome`: signed in → `/home` if onboarded else `/onboarding`; otherwise `<OnboardingFlow mode="welcome">`. `/welcome/done` → `FinishSignup` (client).
- `/login`: `next` must match `/^\/(?![/\\])/`, default `/home`; Google `<a href="/api/auth/google?returnTo=…">`; dev login if `providers.dev`. **No Apple button.** Shows `?error=` (≤200 chars).
- `(app)/layout.tsx`: `requireViewer()` (401 → /login, no `?next`), `OfflineBanner`.
- `/home`: `requireOnboardedViewer`; parallel `serverApiOrNull` `/plan`, `/dashboard`, `/water`; TodayCard, PlanSummary, GetAppCard; Export `<a href="/api/export">`; SignOut + DangerZone imported from `(tabs)/profile/profile-controls.tsx`.
- `/onboarding` (new|edit by `onboardedAt`), `/onboarding/plan` (plan or `TooFastPlan` → `POST /api/goal/option`), `/onboarding/app`.
- `/dev/ui` 404 in production.

## Auth

Web never touches tokens: the API sets an httpOnly cookie (prod `__Secure-fitlens_session`, Domain `.fitr8.com`; local host-only `fitlens_session` on localhost, shared across ports). Google/export links are `apiUrl(...)` hrefs. `lib/server/api.ts`: `serverApi()` forwards cookie, x-forwarded-for, x-request-id; 401 → `redirect("/login")`; errors → `ApiError(status, body.error, body.details)`; `serverApiOrNull` swallows ApiError; `currentUser()`; `requireViewer` (cached, tz default `Asia/Kolkata`); `requireOnboardedViewer`. Browser `lib/client/api.ts`: 401 → `location.assign("/login")`. Providers `lib/server/providers.ts` (fallback `{google:true, apple:false, dev:false}`). Sign out `POST /api/auth/signout`; delete account = `window.prompt("DELETE")` → `DELETE /api/account`.

## Onboarding

- Steps (`components/onboarding/onboarding-flow.tsx:34`): welcome = name, goal, about, training, signin; new/edit = goal, about, training.
- Draft `lib/onboarding/draft.ts` (strings; `validateStep`; `toPayload()` → `OnboardingInput`; experience defaults BEGINNER, 3 days, 45 min; browser tz). Live estimate `lib/onboarding/estimate.ts` (domain `planGoal`, `bodyFatNavy`).
- sessionStorage `lib/onboarding/pending.ts`: `fitr8.onboarding.calculator`, `fitr8.onboarding.pending` (read via `useSyncExternalStore`).
- Finish (`app/(welcome)/welcome/done/finish-signup.tsx`): take pending → PATCH name (errors swallowed) → POST `/api/onboarding` behind ≥2.6 s screen → `/onboarding/plan?flow=welcome`.

## Pro

Web ignores Pro: never reads `MeDto.plan`, `UsageDto.plan/paywall`, `/api/billing`. Hardcoded "Free plan"/"Go Pro" and `[PRICE]` in `components/ai-limit-sheet.tsx` (only on dead screens). `/home` shows no plan.

## Env

`NEXT_PUBLIC_API_URL` (browser + SSR fallback; build time), `API_INTERNAL_URL` (optional SSR override), `APP_STORE_URL`, `PLAY_STORE_URL`. GA Measurement ID is a constant, not env: `lib/ga-id.ts` `GA_MEASUREMENT_ID` (empty = no GA, no banner).

## Analytics (docs/ANALYTICS.md)

`lib/client/analytics.ts`: `GA_ID` (from `lib/ga-id.ts`), consent in localStorage `fitr8.analytics-consent` (`useConsent` via useSyncExternalStore; blocked storage = no choice), `setConsent("denied")` sets `ga-disable-<id>` + deletes `_ga*` cookies, `track()` only when GA_ID and granted (`sendGAEvent`). `components/analytics.tsx`: `<Analytics/>` in root layout renders banner until a choice, `<GoogleAnalytics>` (@next/third-parties 16.3.6) only when granted; `AnalyticsChoice` on `/privacy`. Events: calculator_used (calculator CTA), store_click (`components/store-badge-link.tsx`), onboarding_complete (onboarding-flow non-edit, finish-signup). No web `login` event (Google sign-in is a server redirect).

## Tests

Vitest node env, `src/**/*.test.ts`: `lib/onboarding/{draft,estimate,pending}.test.ts`, `app/(app)/coach/stream.test.ts`, `app/(app)/log/[id]/rows.test.ts`, `lib/client/analytics.test.ts` (consent gating). No component/E2E tests; untested: serverApi, offline queue, finish-signup, login `next` sanitiser.

## Duplication

`lib/onboarding/draft.ts` and `app/(app)/log/[id]/rows.ts` are copied in mobile. Label maps (goal/diet/activity) repeated across files; numeric ranges duplicated instead of from contracts.
