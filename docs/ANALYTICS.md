# Google Analytics (web + app)

One Google Analytics 4 property, two data streams: the **website** (gtag) and the **app** (Firebase
Analytics, Android + iOS). Both send the same event names, so reports line up.

Everything is **off until configured**: while the Measurement ID constant is empty and the Firebase
files aren't committed, no Google script loads on the web, no cookie banner shows, and app builds
contain no Firebase configuration. Nothing comes from environment variables: these IDs are public
(the Measurement ID is in every page's source; the Firebase files only identify the project).

## What is sent

Events and their params are defined once in `packages/contracts/src/analytics.ts`:

| Event                 | Params                                                   | Where                                      |
| --------------------- | -------------------------------------------------------- | ------------------------------------------ |
| `login`               | `method`: google / apple / dev                           | app                                        |
| `onboarding_complete` | `platform`: web / app (first onboarding, not goal edits) | web, app                                   |
| `meal_logged`         | `method`: photo / type / barcode / label / usual         | app (first save only, not edits)           |
| `coach_message`       | –                                                        | app                                        |
| `pro_purchase`        | `period`: month / year                                   | app                                        |
| `calculator_used`     | –                                                        | web landing                                |
| `store_click`         | `store`: app_store / play_store                          | web landing                                |
| screen / page views   | app: route pattern (`log/[id]`, never ids); web: GA auto | both                                       |

The app also sets the GA user id to FITR8's internal user id (cleared on sign-out). **Never** add
health values (weight, kcal, body fat, targets), names, emails, photos or free text to an event.

Privacy setup:

- **Web:** Google's script and cookies load only after the visitor taps **Allow** in the banner
  (`components/analytics.tsx`). The choice is stored in `localStorage` (`fitr8.analytics-consent`)
  and can be changed on `/privacy`. "No thanks" or withdrawing disables gtag and deletes `_ga*` cookies.
- **App:** no advertising ID (iOS `withoutAdIdSupport`, Android `com.google.android.gms.permission.AD_ID`
  blocked, `google_analytics_adid_collection_enabled` / `ssaid` off in `apps/mobile/firebase.json`),
  so no App Tracking Transparency prompt. Automatic screen reporting is off; the app logs route
  patterns itself (`src/app/_layout.tsx`).
- Store answers: `docs/STORE.md` §7. Policy text: `/privacy` §2 and §4.

## Setup (once, by the Google account that owns FITR8)

### 1. Firebase project + GA4 property

1. <https://console.firebase.google.com> → **Add project** (e.g. `fitr8-prod`) → **enable Google
   Analytics** → create or pick a GA4 account. This creates the GA4 property.
2. In Firebase → Project settings → **Add app**:
   - **Android**, package `com.fitr8.app` → download `google-services.json`.
   - **iOS**, bundle id `com.fitr8.app` → download `GoogleService-Info.plist`.
3. In GA4 (<https://analytics.google.com>) → Admin → Data streams → **Add stream → Web** →
   `https://www.fitr8.com` → copy the **Measurement ID** (`G-…`). Keep **Enhanced measurement** on
   (page views on client-side navigation).
4. GA4 Admin → Data collection: leave **Google signals off** (it is ads personalisation). Admin →
   Data retention: pick 2 or 14 months.

### 2. Website

Done: `G-VBQ9FSLRPP` (stream "FITR8 website", www.fitr8.com) is set in `apps/web/src/lib/ga-id.ts`.
The web deploy after merge turns it on; no environment variables. To change it, edit that constant.

### 3. App

Commit both downloaded files to `apps/mobile/` (next to `app.json`):
`apps/mobile/google-services.json` and `apps/mobile/GoogleService-Info.plist`.
`apps/mobile/app.config.ts` switches Firebase on only when **both** are present (the Firebase config
plugin fails the build otherwise). In the Google Cloud console, restrict the API keys inside them to
the Android package / iOS bundle `com.fitr8.app` (Firebase does this for new projects).

This is native code: it ships in a **new store build** (app version 0.3.0+), never as an OTA update.

### 4. Check it works

- Web: open the site, tap **Allow**, then GA4 → Reports → **Realtime** shows you within a minute.
- App: Android `adb shell setprop debug.firebase.analytics.app com.fitr8.app`, open the app, then
  GA4 → Admin → **DebugView**. iOS: run with `-FIRDebugEnabled`.

## Code map

- Event names/params: `packages/contracts/src/analytics.ts`
- Web: `apps/web/src/lib/client/analytics.ts` (`track`, consent), `components/analytics.tsx` (banner +
  `<GoogleAnalytics>`), events in the landing calculator, store badges, onboarding finish.
- App: `apps/mobile/src/lib/analytics.ts` (`track`, `trackScreen`, `setAnalyticsUser`; no-op without
  Firebase, on web preview and in Expo Go), `app.config.ts`, `firebase.json`.
