# FitLens mobile (Expo)

The React Native app for FitLens. It talks to the Next.js app in the repo root, which stays the
backend: every screen calls the same `/api/*` routes the web app uses.

- Expo SDK 57, Expo Router (`src/app` = screens), TanStack Query for data.
- UI follows `docs/DESIGN.md`; tokens are in `src/lib/theme.ts`, components in `src/components/ui`.
- A few pure modules are copied from the web app and must stay in step: `src/lib/format.ts`,
  `onboarding-draft.ts`, `meal-rows.ts`, `barcode.ts`, `label.ts` (each says where it came from).

## Sign-in

The app opens `GET /api/mobile/start` in the system browser (Google sign-in on the web), gets a
one-time code back on `fitlens://auth` (or `exp://…/--/auth` in Expo Go), and trades it plus a PKCE
verifier at `POST /api/mobile/token` for a session token. The token is stored in the Keychain /
Keystore and sent as `Authorization: Bearer …`. See `src/lib/mobile-auth.ts` in the web app.

## Run it on your phone (Expo Go)

1. Install **Expo Go** from the Play Store / App Store.
2. `cd mobile && npm install`
3. Point the app at a server in `mobile/.env` (git-ignored):
   - the deployed site (default, needs the backend changes deployed): nothing to set, or
   - a local dev server on the same Wi-Fi: `EXPO_PUBLIC_API_URL=http://<your-mac-ip>:3000`
     (Google sign-in only works on the deployed https site, so local is mainly for the browser preview).
4. `npx expo start`, then scan the QR code with the camera (iOS) or Expo Go (Android).

Browser preview for quick checks: `EXPO_PUBLIC_API_URL=http://localhost:3000 npx expo start --web`
(the dev server allows CORS from `localhost:8081` in development only).

## Builds for testers (EAS)

```sh
npm i -g eas-cli        # or npx eas-cli@latest …
eas login               # your Expo account
eas init                # links this folder to an Expo project (writes the project id into app.json)
eas build -p android --profile preview      # APK + install link; share it with testers
eas build -p ios --profile production       # needs an Apple Developer account ($99/yr)
eas submit -p ios                           # upload to App Store Connect, then invite testers in TestFlight
```

- **Android:** the `preview` profile makes an APK. Anyone with the link can install it (they allow
  "install unknown apps" once). No store account needed. Play Store closed testing needs a one-time $25
  Google Play developer account and an AAB (`production` profile).
- **iOS:** use TestFlight (up to 10,000 external testers after a short beta review).
- Ship JS-only fixes without a rebuild later with `eas update` (needs `expo-updates`).

## Checks

```sh
npx tsc --noEmit && npx expo lint && npx expo-doctor
```
