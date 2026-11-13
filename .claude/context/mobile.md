# apps/mobile — Expo app (the real product surface)

Paths relative to `apps/mobile/`. expo ~57, react-native 0.86, react 19.2, expo-router ~57, expo-updates ~57, react-native-purchases ^10.13, @tanstack/react-query 5. typedRoutes + reactCompiler on. No babel config. `app.config.ts` extends app.json: always adds `expo-build-properties` (iOS `useFrameworks: "dynamic"`, required by RN Firebase v27 SPM); adds `@react-native-firebase/{app,analytics}` + `googleServicesFile` only when both `GOOGLE_SERVICES_JSON`/`GOOGLE_SERVICE_INFO_PLIST` (EAS file env) or local `google-services.json` + `GoogleService-Info.plist` exist. `/ios` `/android` are CNG (gitignored).

## Navigation (`src/app/_layout.tsx`)

SafeArea → QueryClientProvider → AuthProvider; splash until auth not "loading". `Stack.Protected`: `login` signed-out only; `onboarding` when signed in (also "edit goal"); `(tabs)`, `log`, `briefing`, `history`, `coach`, `pro` (modal) when signed in + `me.onboarded`. `index.tsx` redirects. Tabs: today, workout, progress, profile; custom `components/tab-bar.tsx` centre camera → `/log`. Log stack: `log/index` (photo), `log/type`, `log/[id]`, `log/barcode/{index,[code]}`, `log/label/{index,[id]}`. No `+not-found`, no `auth` route; `src/app/+native-intent.tsx` `redirectSystemPath` rewrites `fitlens://auth?…` (Google sign-in return) to `/` so the router never shows "Unmatched route" (`openAuthSessionAsync` still reads the URL).

## Auth (`src/lib/auth.tsx`, `token-store.ts`, `api.ts`)

- Bearer token in SecureStore key `fitlens.session` (localStorage on web preview). No refresh; server session slides (90 d idle).
- Any 401 with a token → `clear()`: RevenueCat logOut, drop token, `queryClient.clear()`, delete stored token + coach conversation id.
- Startup `readToken` → `/api/me`; 401 → signed out, any other failure → `status: "offline"` (`_layout.tsx` `OfflineStart`, "Try again" → `retry()`). `clear()` also cancels water reminders.
- Google: PKCE → `openAuthSessionAsync(${API_URL}/api/auth/mobile/start?challenge&redirect=Linking.createURL("auth"))` → `POST /api/auth/mobile/token`. Production API rejects `exp://`, so Google fails in Expo Go against prod.
- Apple (iOS only, if `isAvailableAsync()` and `providers.apple`): raw nonce → sha256 to Apple → `POST /api/auth/apple`.
- Dev login if `providers.dev`.

## API client

`src/lib/config.ts`: `EXPO_PUBLIC_API_URL` default `https://api.fitr8.com` (the Nest API directly; eas.json same). Local: `scripts/local.mjs` writes `http://<LAN-IP>:4000` into `apps/mobile/.env`. `api()` → `ApiError(0, OFFLINE)` on network failure. `apiStream` uses `expo/fetch` for coach SSE. React Query (`query.ts`): staleTime 30 s, no retry on 4xx, NetInfo online manager. Shared keys (`queries.ts`): day=`/api/dashboard`, workout=`/api/workouts/today`, water, billing. Photos compressed to 1024 px JPEG before upload.

| Screen     | Endpoints                                                                                                                                                         |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| today      | dashboard, workouts/today, water (+POST/DELETE water)                                                                                                             |
| workout    | workouts/today; POST workouts/logs (set state local only)                                                                                                         |
| progress   | progress; POST checkins                                                                                                                                           |
| profile    | plan, usage, dashboard, billing (if PRO); PATCH profile/reminders; export CSV → share; DELETE account                                                             |
| coach      | conversations/:id; POST coach/chat (SSE); 429 → limit card (no Pro link)                                                                                          |
| pro        | billing; POST billing/refresh                                                                                                                                     |
| log/*      | upload-url → PUT → POST meals; meals/:id poll 1 s ≤60 s; PUT/recheck/DELETE; foods?q; parse-items; barcode/:code (not URL-encoded); quick-add; label (+:id, save) |
| onboarding | plan; POST onboarding; goal/option                                                                                                                                |

## Pro (`src/lib/purchases.ts`, `src/app/pro.tsx`)

- Keys only from `EXPO_PUBLIC_REVENUECAT_IOS_KEY` / `_ANDROID_KEY`; `purchasesAvailable = Boolean(key)`. Not in eas.json (must be EAS env vars).
- `Purchases.configure({apiKey, appUserID: me.id})` lazily after `/api/me`; later `logIn`; sign-out `logOut`. No CustomerInfo listener; server is authoritative.
- Buy: `purchasePackage` → POST `/api/billing/refresh` → invalidate billing/usage → refresh me. Restore similar.
- Upsell (profile PlanCard "Go Pro", photo-scan `AiLimitSheet`) only when `usage.paywall && purchasesAvailable`; header pill reads `usage.plan`. `limits.labelScans` unread; label 402 not handled (only 429). Purchase OK + `/billing/refresh` failure → `syncPending` note, no error. Fallback prices hardcoded in `pro.tsx`; "Coming soon" benefits listed.

## Release config

- `app.json`: name FITR8, slug/scheme `fitlens`, owner `mrdoodler`, bundle/package `com.fitr8.app`, version `0.3.0` (Firebase native modules), `runtimeVersion: {policy: "appVersion"}` (bump version for ANY native change), `usesAppleSignIn`, camera/photo strings, RECORD_AUDIO + `com.google.android.gms.permission.AD_ID` blocked.
- `eas.json`: `appVersionSource: remote`; base node 22.22.0 / pnpm 10.34.6; `preview` internal APK channel `preview`; `production` autoIncrement channel `production`; both `EXPO_PUBLIC_API_URL=https://api.fitr8.com`. No development profile / dev client.
- Unused native deps: expo-device, expo-glass-effect, @expo/ui, expo-symbols, expo-system-ui, expo-constants.
- OTA: see infra.md (`eas-update.yml`).

## Notifications

Water reminders = local notifications (`src/lib/reminders.ts`), not cancelled on sign-out/delete. Lunch/dinner reminders saved server-side only; nothing delivers them.

## Analytics (`src/lib/analytics.ts`, docs/ANALYTICS.md)

Firebase Analytics, lazily `require`d; no-op on web preview, in Expo Go, or when `getApps()` is empty (no config files in the build). `track(name, params)` typed by `AnalyticsEvents` (contracts). `trackScreen` from `_layout.tsx` `Routes` (`useSegments`, groups dropped, route patterns only). `setAnalyticsUser(me.id)` in `auth.tsx` `load`, null in `clear`. Events: login (google/apple/dev after `load`), onboarding_complete (`onboarding/index.tsx`, not when `returning`), meal_logged (`log/[id].tsx` only if status ≠ CONFIRMED, `log/type.tsx` relog, barcode quick-add, label save, briefing snack), coach_message (`coach.tsx` send), pro_purchase (`pro.tsx`). `firebase.json`: adid/ssaid collection + automatic screen reporting off.

## Tests

None in apps/mobile. Copies of web/domain logic (`src/lib/onboarding-draft.ts`, `meal-rows.ts`, `barcode.ts`, `label.ts`, `format.ts`) are tested only via originals; mobile does not depend on `@fitr8/domain`.
