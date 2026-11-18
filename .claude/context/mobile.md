# apps/mobile — Expo app (the real product surface)

Paths relative to `apps/mobile/`. expo ~57, react-native 0.86, react 19.2, expo-router ~57, expo-updates ~57, react-native-purchases ^10.13, @tanstack/react-query 5. typedRoutes + reactCompiler on. No babel config. `app.config.ts` extends app.json: always adds `expo-build-properties` (iOS `useFrameworks: "dynamic"`, required by RN Firebase v27 SPM); adds `@react-native-firebase/{app,analytics}` + `googleServicesFile` only when both committed files `google-services.json` + `GoogleService-Info.plist` exist next to app.json (no env vars). `/ios` `/android` are CNG (gitignored).

## Navigation (`src/app/_layout.tsx`)

SafeArea → QueryClientProvider → AuthProvider; splash until auth not "loading". `Stack.Protected` (declaration ORDER matters: when a guard flips the stack falls back to the first allowed screen, so the app group is declared before `onboarding`, `_layout.tsx:85`): `login` signed-out only; `welcome-back` when signed in + onboarded + `me.welcomeBack` (declared before the app group); `(tabs)`, `log`, `briefing`, `history`, `progress`, `coach`, `reminders`, `pro` (modal) when signed in + onboarded + !welcomeBack; `onboarding` when signed in (also "edit goal"; step-1 back falls back to `/today` when nothing is behind it). `index.tsx` redirects (onboarding / welcome-back / today). Tabs: today, workout, profile; custom `components/tab-bar.tsx` cells Today, Workout, camera FAB → `/log`, Coach button → `/coach` (not a tab), Profile. Log stack: `log/index` (photo + live barcode), `log/type`, `log/[id]`, `log/saved/[id]` (saved-meal builder, `new` = create), `log/barcode/{index,[code]}`, `log/label/{index,[id]}`. `/reminders` is a root stack screen (from Profile). No `+not-found`, no `auth` route; `src/app/+native-intent.tsx` `redirectSystemPath` rewrites `fitlens://auth?…` (Google sign-in return) to `/` so the router never shows "Unmatched route" (`openAuthSessionAsync` still reads the URL).

## Auth (`src/lib/auth.tsx`, `token-store.ts`, `api.ts`)

- Bearer token in SecureStore key `fitlens.session` (localStorage on web preview). No refresh; server session slides (90 d idle).
- Any 401 with a token → `clear()`: RevenueCat logOut, drop token, `queryClient.clear()`, delete stored token + coach conversation id.
- Startup `readToken` → `/api/me`; 401 → signed out, any other failure → `status: "offline"` (`_layout.tsx` `OfflineStart`, "Try again" → `retry()`). `clear()` also cancels water reminders.
- Google: PKCE → `openAuthSessionAsync(${API_URL}/api/auth/mobile/start?challenge&redirect=Linking.createURL("auth"))` → `POST /api/auth/mobile/token`. Production API rejects `exp://`, so Google fails in Expo Go against prod.
- Apple (iOS only, if `isAvailableAsync()` and `providers.apple`): raw nonce → sha256 to Apple → `POST /api/auth/apple`.
- Dev login if `providers.dev`.

## API client

`src/lib/config.ts`: `EXPO_PUBLIC_API_URL` default `https://api.fitr8.com` (the Nest API directly; eas.json same). Local: no `apps/mobile/.env`; `scripts/local.mjs` `mobileApiUrl` passes `EXPO_PUBLIC_API_URL` (root `.env` value, else `http://<LAN-IP>:<API port>`) to Expo's process env (unset would mean production). `api()` → `ApiError(0, OFFLINE)` on network failure. `apiStream` uses `expo/fetch` for coach SSE. React Query (`query.ts`): staleTime 30 s, no retry on 4xx, NetInfo online manager. Shared keys (`queries.ts`): day=`/api/dashboard`, workout=`/api/workouts/today`, water, billing. Photos compressed to 1024 px JPEG before upload.

| Screen     | Endpoints                                                                                                                                                                                                                     |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| today      | dashboard (`?date=` for a past day), progress (card, today only), water (+POST/DELETE water; redo = re-POST the undone ml, local stack in `water-card.tsx`)                                                                   |
| workout    | workouts/today; POST workouts/logs (set state local only)                                                                                                                                                                     |
| progress   | progress (`progressQuery`, shared with Today's Progress card); POST checkins                                                                                                                                                  |
| profile    | plan, usage, dashboard, reminders, billing (if PRO); PATCH profile/reminders; export CSV → share; DELETE account (2 sheets: why + reasons/note + "sign out instead" → type DELETE → native alert; body `{reasons, feedback}`) |
| reminders  | reminders; POST reminders/parse → review sheet → POST reminders; PATCH (toggle/edit); DELETE                                                                                                                                  |
| coach      | conversations/:id; POST coach/chat (SSE); 429 → limit card (no Pro link)                                                                                                                                                      |
| pro        | billing; POST billing/refresh                                                                                                                                                                                                 |
| log/*      | saved-meals (+POST, PUT, DELETE, :id/log); upload-url → PUT → POST meals; meals/:id poll 1 s ≤60 s; PUT/recheck/DELETE; foods?q; parse-items; barcode/:code (not URL-encoded); quick-add; label (+:id, save)                  |
| onboarding | plan; PATCH profile/name (first-time only); POST onboarding; goal/option                                                                                                                                                      |

## Theme / dark mode (2026-11-17)

- `lib/palette.ts`: `palettes.light` / `.dark` (same keys incl. semantic `panel`, `panelLine`, `strong`/`onStrong`, `brandText`, `brandSoft`, `raised`, `danger`, `scrim`), `shadowsFor(scheme)`. `lib/appearance.tsx`: `AppearanceProvider` (root `_layout.tsx`; preference system/light/dark in SecureStore `fitr8.appearance` read synchronously, `Appearance.setColorScheme`, `expo-system-ui` window bg, StatusBar), `useColors()`, `useScheme()`, `useShadows()`, `makeStyles((c, shadows) => …)` (cached per scheme). `lib/theme.ts` re-exports both; there is no static `colors` export any more. `_layout.tsx` `NavigationTheme` maps the palette onto React Navigation. Camera screens (`log/index`, `log/label/index`, `log/barcode/index`) use `palettes.light` constants on purpose (always dark UI). Profile → Appearance segmented. `app.json` `userInterfaceStyle: "automatic"`, version 0.4.0.

## Welcome back (2026-11-17)

`src/app/welcome-back.tsx`: `/api/plan` for hints; weight empty (old weight placeholder), height/activity/equipment/days/minutes/injuries/medical prefilled, waist+neck(+hip F) only for a body-fat goal → `POST /api/welcome-back` → invalidate all → `refresh()`; `goalPassed` → "Set a new goal" (`router.replace("/onboarding")` then refresh) / "Keep my goal". "Not now" → `POST /api/me/active`. Options shared with onboarding via `components/profile-options.tsx`. Analytics `welcome_back {action}`.

## Meal type and day (2026-11-16)

- Meal type defaults from the clock: `lib/meal-param.ts` `useMealChoice()` = `?meal=` else `mealTypeForHour(now)` (never null); `mealChosen` is true once from the route or the user (only then does `params` carry `meal`, and a saved meal keeps its own slot otherwise). `components/log/meal-when.tsx` is one line "Adding to Lunch · Today Change" that expands to meal chips + day chips (today + `MEAL_BACKFILL_DAYS` 7 back; day optional via `onDate`, `prefix` prop). `log/[id].tsx` shows it as "Logged as …" and sends `mealType` on `PUT /api/meals/:id`.
- Today tab: `DaySwitcher` (‹ day ›, up to 7 back) driven by `lib/view-day.ts` (useSyncExternalStore, null = today); past day hides water and the Progress card; the header streak always comes from today's `dayQuery`. Meals heading has a "Past logs" pill → `/history` (screen title "Past logs"). Days page like an app drawer (`components/day-pager.tsx`): `useDayPager` (Reanimated strip offset `index*width`, RNGH Pan on the WHOLE screen via `GestureDetector` in `today.tsx`, activeOffsetX 12 / failOffsetY 12, 1:1 follow, edge resistance, settles 320 ms; arrows slide 420 ms) + `DayStrip` renders a 5-day window (current ± `DAY_WINDOW_RADIUS` 2) of pages keyed by date (each `DayPage` runs its own `dayQueryFor(date)`); `today.tsx` also prefetches the day just outside the window, so a swipe fetches one new day (load: today + 3 back). Swipe pages past 20% width or 400 px/s; loading page = `TodaySkeleton`. `pointerEvents` is set via style (the prop is deprecated on web). The Pan gesture is built ONCE (`useMemo`, reads index/width/last from shared values; `onIndex` must be stable — `go` is a `useCallback`): rebuilding it per render made RNGH re-attach mid-touch and throw "releasePointerCapture: Invalid pointer id" on web. Web only: a capture-phase click listener swallows the click within 350 ms of a swipe end (mouse drags that start on a button otherwise press it). `DaySwitcher` fixed 60 px (second line: "Swipe for earlier days" / "Back to today"). Root `_layout.tsx` wraps in `GestureHandlerRootView`. Shared values use `.get()/.set()` (React Compiler lint). Meals are grouped by Breakfast/Lunch/Snack/Dinner, each with its own add button carrying `meal` (+`date`). Saving a past-day meal calls `showDay(date)` so Today lands on that day. `nextMealType`/`mealTypeForHour` in `lib/format.ts` are now unused on mobile.
- Meal review (`log/[id].tsx`): undo/redo of items + ghee via `lib/use-history.ts` (local, 50 steps); shows "Logging for …" for a past day.

## Pro (`src/lib/purchases.ts`, `src/app/pro.tsx`)

- Keys only from `EXPO_PUBLIC_REVENUECAT_IOS_KEY` / `_ANDROID_KEY`; `purchasesAvailable = Boolean(key)`. Not in eas.json (must be EAS env vars).
- `Purchases.configure({apiKey, appUserID: me.id})` lazily after `/api/me`; later `logIn`; sign-out `logOut`. No CustomerInfo listener; server is authoritative.
- Buy: `purchasePackage` → POST `/api/billing/refresh` → invalidate billing/usage → refresh me. Restore similar.
- Upsell (profile PlanCard "Go Pro", photo-scan `AiLimitSheet`) only when `usage.paywall && purchasesAvailable`; header pill reads `usage.plan`. `limits.labelScans` unread; label 402 not handled (only 429). Purchase OK + `/billing/refresh` failure → `syncPending` note, no error. Fallback prices hardcoded in `pro.tsx`; "Coming soon" benefits listed.

## Release config

- `app.json`: name FITR8, slug/scheme `fitlens`, owner `mrdoodler`, bundle/package `com.fitr8.app`, version `0.4.0` (0.3.0 Firebase native modules; 0.4.0 `userInterfaceStyle: automatic`), `runtimeVersion: {policy: "appVersion"}` (bump version for ANY native change), `usesAppleSignIn`, camera/photo strings, RECORD_AUDIO + `com.google.android.gms.permission.AD_ID` blocked.
- `eas.json`: `appVersionSource: remote`; base node 22.22.0 / pnpm 10.34.6; `preview` internal APK channel `preview`; `production` autoIncrement channel `production`; both `EXPO_PUBLIC_API_URL=https://api.fitr8.com`. No development profile / dev client.
- Unused native deps: expo-device, expo-glass-effect, @expo/ui, expo-symbols, expo-system-ui, expo-constants.
- OTA: see infra.md (`eas-update.yml`).

## Camera permission (2026-11-18)

- Bug fixed: `expo-image-picker` plugin with `"cameraPermission": false` BLOCKS `android.permission.CAMERA` app-wide (`tools:node="remove"`), so expo-camera could never get permission on Android (every build since 2026-09-29; iOS unaffected). `app.json` now gives image-picker the same camera string as expo-camera. Native change → needs a store build (0.4.0 not yet shipped, so no version bump).
- Camera screens (`log/index.tsx`, `log/barcode/index.tsx`, `log/label/index.tsx`) request the system prompt on first open when status is `undetermined`; the in-screen "Allow camera" button remains the fallback.

## Notifications

- Water reminders = one-off local notifications, 7 days ahead (`src/lib/reminders.ts`). Lunch/dinner switches are saved server-side only; nothing delivers them.
- Custom reminders: `syncCustomReminders` (`lib/reminders.ts:185`) cancels every `rem-*` notification and schedules each enabled reminder's API `slots` as MONTHLY (`day`), WEEKLY (weekday+1, expo 1 = Sunday) or DAILY triggers, plus one-off DATE triggers for `upcoming` wall-clock times (`localDate`), re-planned whenever the list is fetched (launch); runs serialized. Called by `useReminderSync` in `(tabs)/_layout.tsx:25` whenever `remindersQuery` data changes (launch, any change on the Reminders screen). Permission asked on first save (`ensureNotificationPermission`), on turning water reminders on (Profile), and by `components/reminder-prompt.tsx` (mounted in `(tabs)/_layout.tsx`): once per install (SecureStore `fitr8.reminderPromptShown`), 1.2 s after reaching the app, only if notification status is undetermined, water reminders are off and `remindersAvailable`; "Turn on" → system prompt → PATCH water on + `syncWaterReminders` + confirmation; "Not now" never asks again. `auth.tsx` `clear()` cancels water + custom reminders.

## Photo scanner: barcode path (2026-11-18)

`log/index.tsx`: no barcode mode, no ModeTabs (Gallery / shutter / Type row only). `CameraView` scans EAN/UPC live; reads go to `lib/barcode.ts` `decideRead` (last 1.5 s: one code ≥3 reads and ≥3:1 over all others, 8-digit codes ≥4 and never while a longer code is in view) → auto-opens `/log/barcode/[code]` (vibrate), once per time it's in frame (`opened` ref cleared 1.2 s after it leaves); hint + shutter use `leadingRead`; scanning paused while not focused (`useIsFocused`). Shutter: barcode in view → product, else photo → `barcodeInPhoto` (`scanFromURLAsync`) → product or AI upload. Barcode product / label steppers cap at the API limits (100 servings, 5000 g). `ModeTabs` (Type / Photo) is only on `log/type.tsx`; `log/barcode/index.tsx` redirects to `/log`. Product 404 → `NotFound` prefilled from `BarcodeNotFoundDetails` (name/brand) → label scan.

## Saved meals

`/log/type` "Saved meals" (`logSaved`, `type.tsx:70`: picked meal → else the saved meal's `mealType` → else "Pick a meal first"). Builder `log/saved/[id].tsx`. Meal review "Save as a meal" → `components/log/save-meal-sheet.tsx` (POSTs current rows, works before confirming). Helpers `lib/saved-meals.ts`.

## Analytics (`src/lib/analytics.ts`, docs/ANALYTICS.md)

Firebase Analytics, lazily `require`d; no-op on web preview, in Expo Go, or when `getApps()` is empty (no config files in the build). `track(name, params)` typed by `AnalyticsEvents` (contracts). `trackScreen` from `_layout.tsx` `Routes` (`useSegments`, groups dropped, route patterns only). `setAnalyticsUser(me.id)` in `auth.tsx` `load`, null in `clear`. Events: login (google/apple/dev after `load`), onboarding_complete (`onboarding/index.tsx`, not when `returning`), meal_logged (`log/[id].tsx` only if status ≠ CONFIRMED, `log/type.tsx` relog + saved, barcode quick-add, label save, briefing snack), saved_meal_created, reminder_created, coach_message (`coach.tsx` send), pro_purchase (`pro.tsx`). `firebase.json`: adid/ssaid collection + automatic screen reporting off.

## Tests

None in apps/mobile. Copies of web/domain logic (`src/lib/onboarding-draft.ts`, `meal-rows.ts`, `barcode.ts`, `label.ts`, `format.ts`, `person.ts`) are tested only via originals; mobile does not depend on `@fitr8/domain`.

## Onboarding (2026-11-18)

`app/onboarding/index.tsx`: steps 0 "What can we call you?" (first-time only; `DetailsStep`: names + optional phone with a flag button opening `components/sheet.tsx` country list), 1 goal, 2 "About you" (body + food/training, `LAST_STEP` `:68`); returning ("edit goal") users start at 1. Step 2 = two `FoldSection`s (`:481`, icon badge → tick, summary from `lib/onboarding-summary.ts`, `LayoutAnimation` on fold `:181`). Continue dimmed (not disabled) until the step is valid; tapping shows the errors; the hint names the first problem (`hintFor`, same labels as web). Step 0 Continue calls `/api/profile/phone-check`; submit PATCHes `/api/profile/name` before POST onboarding (409 → back to step 0). Rules in `lib/person.ts` (copy of domain `person.ts`). Waist/neck/hip only for a body-fat goal; medical checkbox reveals an optional note (`MEDICAL_NOTE_MAX`). Profile header shows first + last name.
